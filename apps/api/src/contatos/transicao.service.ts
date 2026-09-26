import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types, type Model } from 'mongoose';
import { TotpService } from '../auth/totp.service';
import { enderecoCompleto, type EnderecoMinimo } from '../qualidade/completude';
import type { Contato } from './schemas/contato.schema';
import { ContatosService } from './contatos.service';
import { RespostaComErro } from './erros-http';
import type { UsuarioSessao } from './sessao.middleware';

const SEQUENCIA = ['rascunho', 'capturado', 'qualificado', 'cliente'] as const;

@Injectable()
export class TransicaoService {
  constructor(
    @InjectModel('Contato') private readonly contatos: Model<Contato>,
    private readonly contatosService: ContatosService,
    private readonly totp: TotpService,
  ) {}

  async executar(
    id: string,
    para: string | undefined,
    motivo: string | undefined,
    usuario: UsuarioSessao,
    codigoTotp?: string,
  ) {
    const antes = await this.contatosService.exigir(id, usuario, 'editar_contato');
    if (!para || !transicaoPermitida(String(antes.status), para)) {
      throw new RespostaComErro(
        422,
        'TRANSICAO_INVALIDA',
        'Essa passagem de status não existe. Salve o contato e peça a transição seguinte.',
        antes,
      );
    }
    this.checarPapel(String(antes.status), para, usuario);
    await this.exigirTotpDeCliente(para, usuario, codigoTotp);
    const falha = this.checarRegras(antes, para, motivo, usuario);
    if (falha) throw new RespostaComErro(422, falha.codigo, falha.mensagem, antes);
    const set: Record<string, unknown> = {
      status: para,
      alteradoEm: new Date(),
      alteradoPor: new Types.ObjectId(usuario.id),
      sincronizadoEm: new Date(),
    };
    if (para === 'descartado') set.motivoDescarte = motivo?.trim();
    const resultado = await this.contatos.updateOne(
      { _id: id, versao: antes.versao },
      { $set: set, $inc: { versao: 1 } },
    );
    if (resultado.matchedCount === 0) {
      const atual = await this.contatos.findById(id).lean();
      throw new RespostaComErro(
        422,
        'CONFLITO_VERSAO',
        'O contato mudou enquanto a transição era pedida. Abra de novo e confirme o status atual.',
        atual,
      );
    }
    const dados = JSON.parse(JSON.stringify(await this.contatos.findById(id).lean())) as Record<
      string,
      unknown
    >;
    return { http: 200, dados, avisos: [], antes };
  }

  private checarPapel(de: string, para: string, usuario: UsuarioSessao): void {
    const gestao = usuario.papel === 'gestor' || usuario.papel === 'admin';
    if ((para === 'qualificado' || para === 'cliente' || de === 'descartado') && !gestao) {
      throw new RespostaComErro(
        403,
        'PAPEL_INSUFICIENTE',
        'Só gestor ou admin faz essa transição. O contato continua como está.',
        null,
      );
    }
  }

  private async exigirTotpDeCliente(
    para: string,
    usuario: UsuarioSessao,
    codigoTotp: string | undefined,
  ): Promise<void> {
    if (para !== 'cliente' || usuario.stepUp === true) return;
    const veredito = await this.totp.confirmar(usuario.id, codigoTotp ?? '');
    if (!veredito.aceito) {
      throw new RespostaComErro(403, veredito.codigo, veredito.mensagem, null);
    }
  }

  private checarRegras(
    doc: Record<string, unknown>,
    para: string,
    motivo: string | undefined,
    _usuario: UsuarioSessao,
  ): { codigo: string; mensagem: string } | null {
    const lgpd = doc.lgpd as { revogadoEm?: string } | undefined;
    if (lgpd?.revogadoEm && para !== 'descartado') {
      return {
        codigo: 'CONTATO_REVOGADO',
        mensagem: 'Este contato teve o tratamento revogado. Dá para descartar, não para promover.',
      };
    }
    if (para === 'descartado' && !motivo?.trim()) {
      return {
        codigo: 'CAMPOS_OBRIGATORIOS_TRANSICAO',
        mensagem: 'Para descartar, escreva o motivo. O contato continua no status atual.',
      };
    }
    if (para === 'capturado') {
      const score = (doc.completude as { score?: number } | undefined)?.score ?? 0;
      if (score < 25) {
        return {
          codigo: 'CAMPOS_OBRIGATORIOS_TRANSICAO',
          mensagem:
            'Ainda faltam dados para sair de rascunho. Complete nome e um telefone, por exemplo. O rascunho segue salvo.',
        };
      }
    }
    if (para === 'qualificado' || para === 'cliente') {
      if (!aptoQualificado(doc)) {
        return {
          codigo: 'CAMPOS_OBRIGATORIOS_TRANSICAO',
          mensagem:
            'Para qualificar, precisa de nome, CPF ou CNPJ válido e um e-mail ou telefone. O contato continua salvo no status atual.',
        };
      }
    }
    if (para === 'cliente' && !temEndereco(doc)) {
      return {
        codigo: 'CAMPOS_OBRIGATORIOS_TRANSICAO',
        mensagem:
          'Para virar cliente, complete logradouro, número, cidade e UF. O contato continua qualificado.',
      };
    }
    return null;
  }
}

function transicaoPermitida(de: string, para: string): boolean {
  if (para === 'descartado') return de !== 'descartado';
  if (de === 'descartado') return para === 'rascunho' || para === 'capturado';
  const origem = SEQUENCIA.indexOf(de as (typeof SEQUENCIA)[number]);
  const destino = SEQUENCIA.indexOf(para as (typeof SEQUENCIA)[number]);
  return origem >= 0 && destino === origem + 1;
}

function aptoQualificado(doc: Record<string, unknown>): boolean {
  const nome = typeof doc.nome === 'string' && doc.nome.trim().length > 0;
  const pf = doc.pf as { cpfHash?: string } | undefined;
  const pj = doc.pj as { cnpjHash?: string } | undefined;
  const documento = Boolean(pf?.cpfHash || pj?.cnpjHash);
  const emails = (doc.emails as { valor?: string }[] | undefined) ?? [];
  const telefones = (doc.telefones as { e164?: string }[] | undefined) ?? [];
  const meio =
    emails.some((item) => item.valor?.includes('@')) || telefones.some((item) => item.e164);
  return nome && documento && meio;
}

function temEndereco(doc: Record<string, unknown>): boolean {
  const enderecos = (doc.enderecos as EnderecoMinimo[] | undefined) ?? [];
  return enderecos.some((item) => enderecoCompleto(item));
}
