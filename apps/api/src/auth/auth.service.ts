import { createHash, randomBytes } from 'node:crypto';
import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types, type Model } from 'mongoose';
import { RespostaComErro } from '../contatos/erros-http';
import { registrarValidadorDeSessao, type UsuarioSessao } from '../contatos/sessao.middleware';
import { hashSenha, senhaConfere } from './senha';
import { TotpService } from './totp.service';

interface UsuarioDoc {
  _id: Types.ObjectId;
  login: string;
  senhaHash: string;
  nome: string;
  papel: string;
}

interface SessaoDoc {
  tokenHash: string;
  usuarioId: string;
  papel: string;
  nome: string;
  expiraEm: Date;
  stepUpAte?: Date | null;
}

const FALHAS = new Map<string, number[]>();

@Injectable()
export class AuthService implements OnModuleInit, OnModuleDestroy {
  constructor(
    @InjectModel('Usuario') private readonly usuarios: Model<UsuarioDoc>,
    @InjectModel('SessaoToken') private readonly sessoes: Model<SessaoDoc>,
    private readonly totp: TotpService,
  ) {}

  onModuleInit(): void {
    registrarValidadorDeSessao((token) => this.validar(token));
  }

  onModuleDestroy(): void {
    registrarValidadorDeSessao(null);
  }

  async entrar(loginBruto: string, senha: string, codigoTotp?: string) {
    const login = loginBruto.trim().toLowerCase();
    if (this.bloqueado(login)) {
      throw new RespostaComErro(
        429,
        'LOGIN_BLOQUEADO',
        'Muitas senhas erradas. Espere quinze minutos. Nada foi aberto.',
        null,
      );
    }
    const usuario = await this.usuarios.findOne({ login }).lean<UsuarioDoc | null>();
    if (!usuario || !(await senhaConfere(senha, usuario.senhaHash))) {
      this.registrarFalha(login);
      throw new RespostaComErro(
        401,
        'CREDENCIAL_INVALIDA',
        'Usuário ou senha não conferem. Nada foi aberto.',
        null,
      );
    }
    FALHAS.delete(login);
    let stepUpAte: Date | null = null;
    if (codigoTotp?.trim()) {
      const veredito = await this.totp.confirmar(String(usuario._id), codigoTotp);
      if (!veredito.aceito) {
        throw new RespostaComErro(403, veredito.codigo, veredito.mensagem, null);
      }
      stepUpAte = new Date(Date.now() + 5 * 60_000);
    }
    const token = randomBytes(32).toString('base64url');
    const expiraEm = new Date(Date.now() + 12 * 60 * 60 * 1000);
    await this.sessoes.create({
      tokenHash: hashToken(token),
      usuarioId: String(usuario._id),
      papel: usuario.papel,
      nome: usuario.nome,
      expiraEm,
      stepUpAte,
    });
    return {
      token,
      expiraEm,
      usuario: { id: String(usuario._id), papel: usuario.papel, nome: usuario.nome },
      stepUp: stepUpAte != null,
    };
  }

  async stepUp(token: string, codigoTotp: string) {
    const sessao = await this.sessoes.findOne({ tokenHash: hashToken(token) });
    if (!sessao || sessao.expiraEm.getTime() <= Date.now()) {
      throw new RespostaComErro(
        401,
        'SESSAO_AUSENTE',
        'Entre de novo. O passo extra não valeu.',
        null,
      );
    }
    const veredito = await this.totp.confirmar(sessao.usuarioId, codigoTotp);
    if (!veredito.aceito) {
      throw new RespostaComErro(403, veredito.codigo, veredito.mensagem, null);
    }
    sessao.stepUpAte = new Date(Date.now() + 5 * 60_000);
    await sessao.save();
    return { stepUpAte: sessao.stepUpAte };
  }

  async validar(token: string): Promise<UsuarioSessao | null> {
    if (!token) return null;
    const sessao = await this.sessoes
      .findOne({ tokenHash: hashToken(token) })
      .lean<SessaoDoc | null>();
    if (!sessao || new Date(sessao.expiraEm).getTime() <= Date.now()) return null;
    const stepUp = sessao.stepUpAte != null && new Date(sessao.stepUpAte).getTime() > Date.now();
    return { id: sessao.usuarioId, papel: sessao.papel, nome: sessao.nome, stepUp };
  }

  async criarUsuario(loginBruto: string, senha: string, nome: string, papel: string) {
    const login = loginBruto.trim().toLowerCase();
    if (!login || !nome.trim()) {
      throw new Error('Informe login e nome.');
    }
    const existente = await this.usuarios.findOne({ login }).lean();
    if (existente) return { criado: false, id: String(existente._id) };
    const doc = await this.usuarios.create({
      login,
      senhaHash: await hashSenha(senha),
      nome: nome.trim(),
      papel,
      criadoEm: new Date(),
    });
    return { criado: true, id: String(doc._id) };
  }

  private bloqueado(login: string): boolean {
    const corte = Date.now() - 15 * 60_000;
    const marcas = (FALHAS.get(login) ?? []).filter((item) => item >= corte);
    FALHAS.set(login, marcas);
    return marcas.length >= 8;
  }

  private registrarFalha(login: string): void {
    const marcas = FALHAS.get(login) ?? [];
    marcas.push(Date.now());
    FALHAS.set(login, marcas);
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
