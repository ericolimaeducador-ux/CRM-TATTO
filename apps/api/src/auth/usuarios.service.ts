import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types, type Model } from 'mongoose';
import { RespostaComErro } from '../contatos/erros-http';
import { hashSenha } from './senha';
import { TotpService } from './totp.service';
import { PAPEIS, type PapelUsuario } from './perfil-permissoes';

interface UsuarioDoc {
  _id: Types.ObjectId;
  login: string;
  nome: string;
  papel: string;
  ativo?: boolean;
  criadoEm: Date;
}

@Injectable()
export class UsuariosService {
  constructor(
    @InjectModel('Usuario') private readonly usuarios: Model<UsuarioDoc>,
    private readonly totp: TotpService,
  ) {}

  async listar() {
    const itens = await this.usuarios.find().sort({ criadoEm: 1 }).lean<UsuarioDoc[]>();
    return itens.map(vista);
  }

  async criar(loginBruto: string, senha: string, nome: string, papelBruto: string) {
    const papel = papelDe(papelBruto);
    const login = loginBruto.trim().toLowerCase();
    if (!login || !nome.trim() || senha.trim().length < 12) {
      throw new RespostaComErro(
        422,
        'USUARIO_INVALIDO',
        'Informe login, nome e senha com 12 caracteres ou mais. Nada foi criado.',
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
    const doc = await this.usuarios.create({
      login,
      senhaHash: await hashSenha(senha),
      nome: nome.trim(),
      papel,
      ativo: true,
      criadoEm: new Date(),
    });
    return vista(doc.toObject() as UsuarioDoc);
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

  private async exigir(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new RespostaComErro(404, 'USUARIO_AUSENTE', 'Não achei esse usuário.', null);
    }
    const doc = await this.usuarios.findById(id);
    if (!doc) throw new RespostaComErro(404, 'USUARIO_AUSENTE', 'Não achei esse usuário.', null);
    return doc;
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
  };
}
