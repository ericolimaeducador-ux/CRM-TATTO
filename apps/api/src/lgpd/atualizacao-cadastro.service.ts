import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types, type Model } from 'mongoose';
import { montarPatch } from '../contatos/aplicar-campo';
import { aplicarCompletude, vistaComSet } from '../contatos/completude-contato';
import { RespostaComErro } from '../contatos/erros-http';
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
    return {
      nome: contato.nome ?? '',
      email:
        contato.emails?.find((item) => item.principal)?.valor ?? contato.emails?.[0]?.valor ?? '',
      telefone:
        contato.telefones?.find((item) => item.principal)?.e164 ??
        contato.telefones?.[0]?.e164 ??
        contato.telefones?.[0]?.bruto ??
        '',
      cidade: contato.enderecos?.[0]?.cidade ?? '',
      uf: contato.enderecos?.[0]?.uf ?? '',
      expiraEm: dados.expiraEm.toISOString(),
    };
  }

  async atualizar(token: string, corpo: AtualizacaoCadastroDto) {
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
      const antes = contato as unknown as Record<string, unknown>;
      const campos: [string, string | undefined][] = [
        ['nome', corpo.nome],
        ['email', corpo.email],
        ['telefone', corpo.telefone],
        ['cidade', corpo.cidade],
        ['uf', corpo.uf?.toUpperCase()],
      ];
      const set: Record<string, unknown> = {};
      for (const [campo, valor] of campos) {
        if (valor === undefined) continue;
        const patch = montarPatch(antes, campo, valor);
        Object.assign(set, patch.set);
      }
      const vista = vistaComSet(antes, set);
      aplicarCompletude(vista, Boolean(contato.pf?.cpfHash || contato.pj?.cnpjHash));
      contato.set({
        ...set,
        status: vista.status,
        completude: vista.completude,
        sincronizadoEm: new Date(),
      });
      contato.markModified('enderecos');
      contato.$locals.autorId = reservado.emitidoPor;
      contato.$locals.autorNome = 'atualização pelo titular';
      await contato.save();
      return { atualizado: true };
    } catch (erro) {
      await this.tokens.updateOne({ _id: reservado._id }, { $set: { usadoEm: null } });
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

function hash(valor: string): string {
  return createHash('sha256').update(valor).digest('hex');
}
