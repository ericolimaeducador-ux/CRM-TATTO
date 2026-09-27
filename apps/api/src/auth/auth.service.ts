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
  ativo?: boolean;
  trocarSenhaObrigatoria?: boolean;
}

interface SessaoDoc {
  tokenHash: string;
  usuarioId: string;
  papel: string;
  nome: string;
  expiraEm: Date;
  stepUpAte?: Date | null;
  trocarSenhaObrigatoria?: boolean;
}

interface AuditoriaAuth {
  evento: string;
  usuarioId: string;
  porUsuarioId?: string;
  em: Date;
}

const FALHAS = new Map<string, number[]>();

@Injectable()
export class AuthService implements OnModuleInit, OnModuleDestroy {
  constructor(
    @InjectModel('Usuario') private readonly usuarios: Model<UsuarioDoc>,
    @InjectModel('SessaoToken') private readonly sessoes: Model<SessaoDoc>,
    @InjectModel('AuthAuditoria') private readonly auditoria: Model<AuditoriaAuth>,
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
    if (!usuario || usuario.ativo === false || !(await senhaConfere(senha, usuario.senhaHash))) {
      this.registrarFalha(login);
      throw new RespostaComErro(
        401,
        'CREDENCIAL_INVALIDA',
        'Usuário ou senha não conferem. Nada foi aberto.',
        null,
      );
    }
    FALHAS.delete(login);
    const usuarioId = String(usuario._id);
    const inscrito = await this.totp.inscrito(usuarioId);
    let stepUpAte: Date | null = null;
    if (inscrito) {
      if (!codigoTotp?.trim()) {
        throw new RespostaComErro(
          403,
          'TOTP_OBRIGATORIO',
          'Este usuário já inscreveu o autenticador. Informe o código de 6 dígitos. Nada foi aberto.',
          null,
        );
      }
      const veredito = await this.totp.confirmar(usuarioId, codigoTotp, Date.now(), 'login');
      if (!veredito.aceito) {
        throw new RespostaComErro(403, veredito.codigo, veredito.mensagem, null);
      }
      stepUpAte = new Date(Date.now() + 5 * 60_000);
    }
    const trocarSenhaObrigatoria = usuario.trocarSenhaObrigatoria === true;
    const token = randomBytes(32).toString('base64url');
    const expiraEm = new Date(Date.now() + 12 * 60 * 60 * 1000);
    await this.sessoes.create({
      tokenHash: hashToken(token),
      usuarioId,
      papel: usuario.papel,
      nome: usuario.nome,
      expiraEm,
      stepUpAte,
      trocarSenhaObrigatoria,
    });
    return {
      token,
      expiraEm,
      usuario: { id: usuarioId, papel: usuario.papel, nome: usuario.nome },
      stepUp: stepUpAte != null,
      precisaInscreverTotp: usuario.papel === 'admin' && !inscrito,
      trocarSenhaObrigatoria,
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
    const veredito = await this.totp.confirmar(sessao.usuarioId, codigoTotp, Date.now(), 'passo');
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
    const totpPendente = sessao.papel === 'admin' && !(await this.totp.inscrito(sessao.usuarioId));
    return {
      id: sessao.usuarioId,
      papel: sessao.papel,
      nome: sessao.nome,
      stepUp,
      totpPendente,
      trocarSenhaObrigatoria: sessao.trocarSenhaObrigatoria === true,
    };
  }

  async sair(token: string): Promise<void> {
    if (!token) return;
    await this.sessoes.deleteOne({ tokenHash: hashToken(token) });
  }

  async trocarSenha(usuarioId: string, senhaAtual: string, senhaNova: string, tokenAtual = '') {
    const usuario = await this.usuarios.findById(usuarioId).lean<UsuarioDoc | null>();
    if (!usuario || !(await senhaConfere(senhaAtual, usuario.senhaHash))) {
      throw new RespostaComErro(
        401,
        'SENHA_ATUAL_INVALIDA',
        'A senha atual não confere. A senha não mudou.',
        null,
      );
    }
    if (senhaNova.trim() === senhaAtual.trim()) {
      throw new RespostaComErro(
        422,
        'SENHA_REPETIDA',
        'A senha nova precisa ser diferente da atual. A senha não mudou.',
        null,
      );
    }
    let senhaHash: string;
    try {
      senhaHash = await hashSenha(senhaNova);
    } catch {
      throw new RespostaComErro(
        422,
        'SENHA_CURTA',
        'A senha nova precisa de 12 caracteres ou mais. A senha não mudou.',
        null,
      );
    }
    await this.usuarios.updateOne(
      { _id: usuario._id },
      { $set: { senhaHash, trocarSenhaObrigatoria: false } },
    );
    await this.sessoes.updateOne(
      { usuarioId, tokenHash: hashToken(tokenAtual) },
      { $set: { trocarSenhaObrigatoria: false } },
    );
    const apagadas = await this.sessoes.deleteMany({
      usuarioId,
      tokenHash: { $ne: hashToken(tokenAtual) },
    });
    await this.auditoria.create({ evento: 'troca_senha', usuarioId, em: new Date() });
    return { trocada: true, outrasSessoesEncerradas: apagadas.deletedCount };
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
      ativo: true,
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
