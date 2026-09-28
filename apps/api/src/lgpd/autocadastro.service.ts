import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types, type Model } from 'mongoose';
import { montarCriacao } from '../contatos/aplicar-campo';
import { RespostaComErro } from '../contatos/erros-http';
import type { Contato } from '../contatos/schemas/contato.schema';
import type { UsuarioSessao } from '../contatos/sessao.middleware';
import type { AutocadastroDto } from './autocadastro.dto';
import { gravarConcessao } from './consentimento.service';
import { conferirCaptcha } from './captcha';
import { classificarPedido } from './pedidos-publicos';
import { limiteDeUsosDoToken, prazoTokenSegundos } from './prazo-token';

interface TokenDoc {
  token: string;
  vendedorId: Types.ObjectId;
  expiraEm: Date;
  usos: number;
  limiteUsos: number;
  revogadoEm?: Date | null;
}

interface DocNovo {
  set(caminho: string, valor: unknown): unknown;
  get(caminho: string): unknown;
  markModified(caminho: string): void;
  save(): Promise<unknown>;
  _id: Types.ObjectId;
  $locals: { autorId?: Types.ObjectId; autorNome?: string };
}

@Injectable()
export class AutocadastroService {
  constructor(
    @InjectModel('Contato') private readonly contatos: Model<Contato>,
    @InjectModel('TokenAutocadastro') private readonly tokens: Model<TokenDoc>,
  ) {}

  async emitir(usuario: UsuarioSessao): Promise<{ token: string; caminho: string }> {
    const token = randomBytes(24).toString('hex');
    const agora = new Date();
    await this.tokens.create({
      token,
      vendedorId: new Types.ObjectId(usuario.id),
      criadoEm: agora,
      expiraEm: new Date(agora.getTime() + prazoTokenSegundos() * 1000),
      usos: 0,
      limiteUsos: limiteDeUsosDoToken(),
      revogadoEm: null,
    });
    return { token, caminho: `/p/${token}` };
  }

  async revogar(tokenBruto: string, usuario: UsuarioSessao) {
    const doc = await this.tokens.findOne({ token: tokenBruto });
    if (!doc) recusar(404, 'TOKEN_AUSENTE', 'Este QR não está ativo. Nada foi revogado.');
    const dono = String(doc.vendedorId) === usuario.id;
    const gestao = usuario.papel === 'gestor' || usuario.papel === 'admin';
    if (!dono && !gestao) {
      recusar(403, 'PAPEL_INSUFICIENTE', 'Só quem emitiu o QR, ou um gestor, pode revogá-lo.');
    }
    if (!doc.revogadoEm) {
      doc.revogadoEm = new Date();
      await doc.save();
    }
    return { token: doc.token, revogadoEm: doc.revogadoEm };
  }

  async concluir(corpo: AutocadastroDto, ip: string) {
    const classe = classificarPedido(ip);
    if (classe === 'limite') {
      throw new RespostaComErro(
        429,
        'LIMITE_PUBLICO',
        'Muitos cadastros deste endereço em um minuto. Espere e tente de novo. Nada foi gravado.',
        null,
      );
    }
    // O QR é conferido antes do desafio: um QR vencido, revogado ou já usado mostra o motivo
    // real e não gasta o desafio que o titular acabou de responder.
    await this.conferirToken(corpo.token ?? '');
    const captcha = await conferirCaptcha(corpo);
    if (captcha === 'nao_configurado') {
      throw new RespostaComErro(
        429,
        'CAPTCHA_NAO_CONFIGURADO',
        'O captcha externo foi pedido e o segredo não está configurado. Nada foi gravado.',
        null,
      );
    }
    if (captcha !== 'ok') {
      throw new RespostaComErro(
        422,
        'CAPTCHA_INVALIDO',
        'O desafio não confere. Peça outro e tente de novo. Nada foi gravado.',
        null,
      );
    }
    if (corpo.contatoComercial !== true) {
      throw new RespostaComErro(
        422,
        'CONSENTIMENTO_OBRIGATORIO',
        'Sem a autorização de contato comercial o autocadastro não é concluído. Nada foi gravado.',
        null,
      );
    }
    const token = await this.reservar(corpo.token ?? '');
    const montado = montarCriacao({
      nome: corpo.nome,
      email: corpo.email,
      telefone: corpo.telefone,
      origem: { modo: 'qr_proprio' },
    });
    const contato = new this.contatos(montado.doc) as unknown as DocNovo;
    contato.set('origem.modo', 'qr_proprio');
    contato.set('origem.vendedorAtribuido', token.vendedorId);
    gravarConcessao(
      contato,
      String(token.vendedorId),
      'autocadastro',
      corpo.emDispositivo,
      corpo.envioErp === true,
    );
    contato.$locals.autorId = token.vendedorId;
    contato.$locals.autorNome = 'autocadastro';
    await contato.save();
    const gravado = await this.contatos.findById(contato._id).lean();
    return { dados: gravado, avisos: montado.avisos, erros: [] };
  }

  private async conferirToken(tokenBruto: string): Promise<TokenDoc> {
    const token = tokenBruto.trim();
    const doc = token ? await this.tokens.findOne({ token }).lean<TokenDoc>() : null;
    if (!doc) {
      recusar(
        404,
        'TOKEN_AUSENTE',
        'Este QR não está ativo. Peça outro ao vendedor. Nada foi gravado.',
      );
    }
    if (doc.revogadoEm) {
      recusar(
        410,
        'TOKEN_REVOGADO',
        'Este QR foi revogado. Peça outro ao vendedor. Nada foi gravado.',
      );
    }
    if (new Date(doc.expiraEm).getTime() <= Date.now()) {
      recusar(410, 'TOKEN_EXPIRADO', 'Este QR expirou. Peça outro ao vendedor. Nada foi gravado.');
    }
    if (doc.usos >= doc.limiteUsos) {
      recusar(
        410,
        'TOKEN_ESGOTADO',
        'Este QR já foi usado. Peça outro ao vendedor. Nada foi gravado.',
      );
    }
    return doc;
  }

  private async reservar(tokenBruto: string): Promise<TokenDoc> {
    const token = tokenBruto.trim();
    const doc = await this.conferirToken(token);
    const reservado = await this.tokens
      .findOneAndUpdate(
        { token, revogadoEm: null, expiraEm: { $gt: new Date() }, usos: { $lt: doc.limiteUsos } },
        { $inc: { usos: 1 } },
        { new: true },
      )
      .lean<TokenDoc>();
    if (!reservado) {
      recusar(
        410,
        'TOKEN_ESGOTADO',
        'Este QR já foi usado. Peça outro ao vendedor. Nada foi gravado.',
      );
    }
    return reservado;
  }
}

function recusar(status: number, codigo: string, mensagem: string): never {
  throw new RespostaComErro(status, codigo, mensagem, null);
}
