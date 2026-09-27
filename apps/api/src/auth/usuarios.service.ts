import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types, type Model } from 'mongoose';
import { RespostaComErro } from '../contatos/erros-http';
import { hashSenha } from './senha';
import { gerarSenhaProvisoria } from './senha-provisoria';
import { TotpService } from './totp.service';
import { PAPEIS, type PapelUsuario } from './perfil-permissoes';

interface UsuarioDoc {
  _id: Types.ObjectId;
  login: string;
  nome: string;
  papel: string;
  ativo?: boolean;
  trocarSenhaObrigatoria?: boolean;
  criadoEm: Date;
}

interface AuditoriaAuth {
  evento: string;
  usuarioId: string;
  porUsuarioId?: string;
  em: Date;
}

export interface ConfiguracaoTotp {
  segredoBase32: string;
  otpauth: string;
}

@Injectable()
export class UsuariosService {
  constructor(
    @InjectModel('Usuario') private readonly usuarios: Model<UsuarioDoc>,
    @InjectModel('SessaoToken') private readonly sessoes: Model<{ usuarioId: string }>,
    @InjectModel('AuthAuditoria') private readonly auditoria: Model<AuditoriaAuth>,
    private readonly totp: TotpService,
  ) {}

  async listar() {
    const itens = await this.usuarios.find().sort({ criadoEm: 1 }).lean<UsuarioDoc[]>();
    return itens.map(vista);
  }

  /**
   * Cria a conta com senha provisória (gerada, se o admin não digitar uma) e
   * troca obrigatória no primeiro acesso. Conta admin já nasce com o
   * autenticador ativo; o segredo volta só nesta resposta.
   */
  async criar(
    loginBruto: string,
    senhaDigitada: string,
    nome: string,
    papelBruto: string,
    porUsuarioId = '',
  ) {
    const papel = papelDe(papelBruto);
    const login = loginBruto.trim().toLowerCase();
    const digitada = senhaDigitada.trim();
    if (!login || !nome.trim() || (digitada && digitada.length < 12)) {
      throw new RespostaComErro(
        422,
        'USUARIO_INVALIDO',
        'Informe login e nome. A senha é opcional; se digitar, use 12 caracteres ou mais. Nada foi criado.',
        null,
      );
    }
    const existente = await this.usuarios.findOne({ login }).lean();
    if (existente) {
      throw new RespostaComErro(
        422,
        'LOGIN_EXISTENTE',
        'Esse login já existe. A senha não foi trocada.',
        null,
      );
    }
    const gerada = digitada ? '' : gerarSenhaProvisoria();
    const doc = await this.usuarios.create({
      login,
      senhaHash: await hashSenha(digitada || gerada),
      nome: nome.trim(),
      papel,
      ativo: true,
      trocarSenhaObrigatoria: true,
      criadoEm: new Date(),
    });
    const id = String(doc._id);
    const totp: ConfiguracaoTotp | null = papel === 'admin' ? await this.totp.criarAtivo(id) : null;
    await this.auditar('usuario_criado', id, porUsuarioId);
    return {
      ...vista(doc.toObject() as UsuarioDoc),
      senhaProvisoria: gerada || null,
      senhaGerada: gerada !== '',
      totp,
    };
  }

  async atualizar(id: string, papelBruto: string | undefined, ativo: boolean | undefined) {
    const doc = await this.exigir(id);
    if (papelBruto) doc.papel = papelDe(papelBruto);
    if (ativo === false) doc.ativo = false;
    if (ativo === true) doc.ativo = true;
    await doc.save();
    return vista(doc.toObject() as UsuarioDoc);
  }

  async zerarTotp(id: string) {
    await this.exigir(id);
    await this.totp.zerar(id);
    return { id, totp: 'zerado' };
  }

  /** Senha provisória nova: encerra as sessões da pessoa e exige troca no próximo acesso. */
  async gerarNovaSenha(id: string, porUsuarioId: string) {
    const doc = await this.exigir(id);
    recusarPropria(id, porUsuarioId, 'Para a sua própria conta, use Trocar senha.');
    const senhaProvisoria = gerarSenhaProvisoria();
    doc.set({ senhaHash: await hashSenha(senhaProvisoria), trocarSenhaObrigatoria: true });
    await doc.save();
    const encerradas = await this.sessoes.deleteMany({ usuarioId: id });
    await this.auditar('senha_gerada_admin', id, porUsuarioId);
    return { id, senhaProvisoria, sessoesEncerradas: encerradas.deletedCount };
  }

  /** Autenticador novo já ativo para uma conta admin; o anterior deixa de valer. */
  async regenerarTotp(id: string, porUsuarioId: string) {
    const doc = await this.exigir(id);
    recusarPropria(
      id,
      porUsuarioId,
      'Para o seu próprio autenticador, use Inscrever autenticador em Entrar.',
    );
    if (doc.papel !== 'admin') {
      throw new RespostaComErro(
        422,
        'TOTP_SO_ADMIN',
        'Só contas admin usam autenticador. Nada foi alterado.',
        null,
      );
    }
    const totp = await this.totp.criarAtivo(id);
    const encerradas = await this.sessoes.deleteMany({ usuarioId: id });
    await this.auditar('totp_regenerado_admin', id, porUsuarioId);
    return { id, totp, sessoesEncerradas: encerradas.deletedCount };
  }

  private async auditar(evento: string, usuarioId: string, porUsuarioId: string) {
    await this.auditoria.create({
      evento,
      usuarioId,
      ...(porUsuarioId ? { porUsuarioId } : {}),
      em: new Date(),
    });
  }

  private async exigir(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new RespostaComErro(404, 'USUARIO_AUSENTE', 'Não achei esse usuário.', null);
    }
    const doc = await this.usuarios.findById(id);
    if (!doc) throw new RespostaComErro(404, 'USUARIO_AUSENTE', 'Não achei esse usuário.', null);
    return doc;
  }
}

function recusarPropria(id: string, porUsuarioId: string, mensagem: string): void {
  if (porUsuarioId && id === porUsuarioId) {
    throw new RespostaComErro(422, 'CONTA_PROPRIA', `${mensagem} Nada foi alterado.`, null);
  }
}

function papelDe(valor: string): PapelUsuario {
  if ((PAPEIS as readonly string[]).includes(valor)) return valor as PapelUsuario;
  throw new RespostaComErro(
    422,
    'PAPEL_INVALIDO',
    'O perfil precisa ser vendedor, gestor, admin ou auditor. Nada foi alterado.',
    null,
  );
}

function vista(doc: UsuarioDoc) {
  return {
    id: String(doc._id),
    login: doc.login,
    nome: doc.nome,
    papel: doc.papel,
    ativo: doc.ativo !== false,
    trocarSenhaObrigatoria: doc.trocarSenhaObrigatoria === true,
  };
}
