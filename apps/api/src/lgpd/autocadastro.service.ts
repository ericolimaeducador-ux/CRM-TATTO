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
import { classificarPedido } from './pedidos-publicos';

interface TokenDoc {
  token: string;
  vendedorId: Types.ObjectId;
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
    await this.tokens.create({
      token,
      vendedorId: new Types.ObjectId(usuario.id),
      criadoEm: new Date(),
    });
    return { token, caminho: `/p/${token}` };
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
    if (classe === 'captcha') {
      throw new RespostaComErro(
        429,
        'CAPTCHA_NAO_CONFIGURADO',
        'A partir da quarta tentativa deste endereço o autocadastro pede captcha, e nenhum provedor foi indicado. Nada foi gravado.',
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
    const token = await this.tokens.findOne({ token: corpo.token ?? '' }).lean<TokenDoc>();
    if (!token) {
      throw new RespostaComErro(
        404,
        'TOKEN_AUSENTE',
        'Este QR não está ativo. Peça outro ao vendedor. Nada foi gravado.',
        null,
      );
    }
    const montado = montarCriacao({
      nome: corpo.nome,
      email: corpo.email,
      telefone: corpo.telefone,
      origem: { modo: 'qr_proprio' },
    });
    const contato = new this.contatos(montado.doc) as unknown as DocNovo;
    contato.set('origem.modo', 'qr_proprio');
    contato.set('origem.vendedorAtribuido', token.vendedorId);
    gravarConcessao(contato, String(token.vendedorId), 'autocadastro', corpo.emDispositivo);
    contato.$locals.autorId = token.vendedorId;
    contato.$locals.autorNome = 'autocadastro';
    await contato.save();
    const gravado = await this.contatos.findById(contato._id).lean();
    return { dados: gravado, avisos: montado.avisos, erros: [] };
  }
}
