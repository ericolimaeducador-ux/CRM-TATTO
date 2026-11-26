import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types, type Model } from 'mongoose';
import { montarPatch } from '../contatos/aplicar-campo';
import { aplicarCompletude, vistaComSet } from '../contatos/completude-contato';
import { duplicidadeNomeada, ehDuplicidadeDocumento } from '../contatos/contato-escrita';
import { RespostaComErro } from '../contatos/erros-http';
import { normalizarCnpj, normalizarCpf } from '../normalizacao/normalizar';
import type { Contato } from '../contatos/schemas/contato.schema';
import type { UsuarioSessao } from '../contatos/sessao.middleware';
import type { AtualizacaoCadastroDto } from './atualizacao-cadastro.dto';

interface TokenAtualizacao {
  tokenHash: string;
  contatoId: Types.ObjectId;
  emitidoPor: Types.ObjectId;
  criadoEm: Date;
  expiraEm: Date;
  usadoEm?: Date | null;
}

type DocumentoContato = {
  _id: Types.ObjectId;
  nome?: string;
  emails?: { valor?: string }[];
  telefones?: { e164?: string; bruto?: string }[];
  enderecos?: { cidade?: string; uf?: string }[];
  versao?: number;
  pf?: { cpfHash?: string };
  pj?: { cnpjHash?: string };
  status?: string;
  set(caminho: string | Record<string, unknown>, valor?: unknown): void;
  markModified(caminho: string): void;
  save(): Promise<unknown>;
  $locals: { autorId?: Types.ObjectId; autorNome?: string };
};

@Injectable()
export class AtualizacaoCadastroService {
  constructor(
    @InjectModel('Contato') private readonly contatos: Model<Contato>,
    @InjectModel('TokenAtualizacaoCadastro') private readonly tokens: Model<TokenAtualizacao>,
  ) {}

  async emitir(contatoId: string, usuario: UsuarioSessao) {
    if (!Types.ObjectId.isValid(contatoId))
      this.recusar(404, 'CONTATO_AUSENTE', 'Contato não encontrado.');
    const contato = await this.contatos.findById(contatoId).lean();
    if (!contato) this.recusar(404, 'CONTATO_AUSENTE', 'Contato não encontrado.');
    const token = randomBytes(32).toString('base64url');
    const agora = new Date();
    const expiraEm = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000);
    await this.tokens.create({
      tokenHash: hash(token),
      contatoId: new Types.ObjectId(contatoId),
      emitidoPor: new Types.ObjectId(usuario.id),
      criadoEm: agora,
      expiraEm,
      usadoEm: null,
    });
    return { token, caminho: `/atualizar-cadastro/${token}`, expiraEm: expiraEm.toISOString() };
  }

  async ler(token: string) {
    const dados = await this.tokenValido(token);
    const contato = await this.contatos.findById(dados.contatoId).lean();
    if (!contato) this.recusar(410, 'LINK_INDISPONIVEL', 'Este link não está mais disponível.');
    const endereco = contato.enderecos?.[0] ?? {};
    const pj = (contato.pj ?? {}) as { razaoSocial?: string; nomeFantasia?: string };
    return {
      tipoPessoa:
        contato.tipoPessoa === 'PF' || contato.tipoPessoa === 'PJ' ? contato.tipoPessoa : '',
      nome: contato.nome ?? '',
      email:
        contato.emails?.find((item) => item.principal)?.valor ?? contato.emails?.[0]?.valor ?? '',
      telefone:
        contato.telefones?.find((item) => item.principal)?.e164 ??
        contato.telefones?.[0]?.e164 ??
        contato.telefones?.[0]?.bruto ??
        '',
      // O documento nunca volta inteiro por um link: só a máscara, para o titular saber que já existe.
      cpfMascarado: contato.pf?.cpfHash ? (contato.pf.cpfMascarado ?? '') : '',
      cnpjMascarado: contato.pj?.cnpjHash ? (contato.pj.cnpjMascarado ?? '') : '',
      razaoSocial: pj.razaoSocial ?? '',
      nomeFantasia: pj.nomeFantasia ?? '',
      cep: endereco.cep ?? '',
      logradouro: endereco.logradouro ?? '',
      numero: endereco.numero ?? '',
      complemento: endereco.complemento ?? '',
      bairro: endereco.bairro ?? '',
      cidade: endereco.cidade ?? '',
      uf: endereco.uf ?? '',
      expiraEm: dados.expiraEm.toISOString(),
    };
  }

  async atualizar(token: string, corpo: AtualizacaoCadastroDto) {
    const campos = camposDoCorpo(corpo);
    // Documento errado volta para o titular corrigir antes de gastar o link.
    for (const [campo, valor] of campos) {
      if (campo === 'cpf' && !normalizarCpf(valor).valido)
        this.recusar(
          422,
          'CPF_INVALIDO',
          'Este CPF não é válido. Confira os números e envie de novo.',
        );
      if (campo === 'cnpj' && !normalizarCnpj(valor).valido)
        this.recusar(
          422,
          'CNPJ_INVALIDO',
          'Este CNPJ não é válido. Confira os números e envie de novo.',
        );
    }
    const reservado = await this.tokens.findOneAndUpdate(
      { tokenHash: hash(token), usadoEm: null, expiraEm: { $gt: new Date() } },
      { $set: { usadoEm: new Date() } },
      { new: true },
    );
    if (!reservado)
      this.recusar(
        410,
        'LINK_INDISPONIVEL',
        'Este link expirou ou já foi usado. Peça um novo link.',
      );
    try {
      const contato = (await this.contatos.findById(
        reservado.contatoId,
      )) as unknown as DocumentoContato | null;
      if (!contato) this.recusar(410, 'LINK_INDISPONIVEL', 'Este link não está mais disponível.');
      const antes = JSON.parse(JSON.stringify(contato)) as Record<string, unknown>;
      let vista = antes;
      const set: Record<string, unknown> = {};
      const unset = new Set<string>();
      for (const [campo, valor] of campos) {
        // Cada pedaço de endereço parte do que já foi aplicado, para não apagar o anterior.
        const patch = montarPatch(vista, campo, valor);
        Object.assign(set, patch.set);
        for (const chave of Object.keys(patch.unset)) unset.add(chave);
        vista = vistaComSet(antes, set);
      }
      aplicarCompletude(
        vista,
        Boolean(
          (vista.pf as { cpfHash?: string } | undefined)?.cpfHash ||
          (vista.pj as { cnpjHash?: string } | undefined)?.cnpjHash,
        ),
      );
      contato.set({
        ...set,
        status: vista.status,
        completude: vista.completude,
        sincronizadoEm: new Date(),
      });
      for (const chave of unset) contato.set(chave, undefined);
      contato.markModified('enderecos');
      contato.$locals.autorId = reservado.emitidoPor;
      contato.$locals.autorNome = 'atualização pelo titular';
      await contato.save();
      return { atualizado: true };
    } catch (erro) {
      await this.tokens.updateOne({ _id: reservado._id }, { $set: { usadoEm: null } });
      if (ehDuplicidadeDocumento(erro)) {
        const documento = duplicidadeNomeada(erro)?.codigo === 'CNPJ_DUPLICADO' ? 'CNPJ' : 'CPF';
        this.recusar(
          409,
          `${documento}_DUPLICADO`,
          `Este ${documento} já está em outro cadastro nosso. Nada foi gravado; fale com quem enviou o link.`,
        );
      }
      throw erro;
    }
  }

  private async tokenValido(token: string): Promise<TokenAtualizacao> {
    const doc = await this.tokens
      .findOne({ tokenHash: hash(token.trim()) })
      .lean<TokenAtualizacao>();
    if (!doc || doc.usadoEm || doc.expiraEm.getTime() <= Date.now())
      this.recusar(
        410,
        'LINK_INDISPONIVEL',
        'Este link expirou ou já foi usado. Peça um novo link.',
      );
    return doc;
  }

  private recusar(status: number, codigo: string, mensagem: string): never {
    throw new RespostaComErro(status, codigo, mensagem, null);
  }
}

const ORDEM_DOS_CAMPOS = [
  'tipoPessoa',
  'nome',
  'email',
  'telefone',
  'cpf',
  'cnpj',
  'razaoSocial',
  'nomeFantasia',
  'cep',
  'logradouro',
  'numero',
  'complemento',
  'bairro',
  'cidade',
  'uf',
] as const;

/** Campos enviados, na ordem de aplicação. CPF/CNPJ em branco = manter o que já existe. */
function camposDoCorpo(corpo: AtualizacaoCadastroDto): [string, string][] {
  const saida: [string, string][] = [];
  for (const campo of ORDEM_DOS_CAMPOS) {
    const valor = corpo[campo];
    if (typeof valor !== 'string') continue;
    if ((campo === 'cpf' || campo === 'cnpj') && !valor.trim()) continue;
    saida.push([campo, campo === 'uf' ? valor.trim().toUpperCase() : valor.trim()]);
  }
  return saida;
}

function hash(valor: string): string {
  return createHash('sha256').update(valor).digest('hex');
}
