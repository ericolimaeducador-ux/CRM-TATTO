import { randomBytes } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { Model } from 'mongoose';
import request from 'supertest';
import { ContatosModule } from '../contatos/contatos.module';
import { AuthModule } from './auth.module';
import { AuthService } from './auth.service';
import { codigoNoPasso, passoAtual } from './totp-rfc6238';

describe('sessão, TOTP obrigatório e senha', () => {
  let app: INestApplication;
  let memoria: MongoMemoryServer;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.CIFRA_CHAVE_BASE64 = randomBytes(32).toString('base64');
    process.env.CIFRA_PEPPER = randomBytes(32).toString('hex');
    memoria = await MongoMemoryServer.create();
    const modulo = await Test.createTestingModule({
      imports: [MongooseModule.forRoot(memoria.getUri()), AuthModule, ContatosModule],
    }).compile();
    app = modulo.createNestApplication();
    await app.init();
    const auth = app.get(AuthService);
    await auth.criarUsuario('erico', 'senha-bem-longa', 'Erico', 'admin');
    await auth.criarUsuario('lia', 'senha-bem-longa', 'Lia', 'vendedor');
  });

  afterAll(async () => {
    await app.close();
    await memoria.stop();
  });

  it('pede TOTP no login de quem já inscreveu e libera a inscrição de qualquer papel', async () => {
    const entrada = await request(app.getHttpServer())
      .post('/v1/auth/entrar')
      .send({ login: 'lia', senha: 'senha-bem-longa' });
    expect(entrada.status).toBe(201);
    expect(entrada.body.dados.precisaInscreverTotp).toBe(false);
    const token = entrada.body.dados.token as string;
    const inscricao = await request(app.getHttpServer())
      .post('/v1/auth/totp/inscrever')
      .set('authorization', `Bearer ${token}`)
      .send({});
    expect(inscricao.status).toBe(201);
    expect(inscricao.body.dados.pendente).toBe(true);
    const segredo = inscricao.body.dados.segredoBase32 as string;
    expect(inscricao.body.dados.otpauth).toBe(
      `otpauth://totp/TattooArt:lia?secret=${segredo}&issuer=TattooArt&digits=6&period=30`,
    );
    const ainda = await request(app.getHttpServer())
      .post('/v1/auth/entrar')
      .send({ login: 'lia', senha: 'senha-bem-longa' });
    expect(ainda.status).toBe(201);
    const ativado = await request(app.getHttpServer())
      .post('/v1/auth/totp/ativar')
      .set('authorization', `Bearer ${token}`)
      .send({ codigoTotp: codigoNoPasso(segredo, passoAtual() - 1) });
    expect(ativado.status).toBe(200);
    const semCodigo = await request(app.getHttpServer())
      .post('/v1/auth/entrar')
      .send({ login: 'lia', senha: 'senha-bem-longa' });
    expect(semCodigo.status).toBe(403);
    expect(semCodigo.body.erros[0].codigo).toBe('TOTP_OBRIGATORIO');
    expect(JSON.stringify(semCodigo.body)).not.toContain('promo');
    expect(semCodigo.body.dados?.token).toBeUndefined();
    const ruim = await request(app.getHttpServer())
      .post('/v1/auth/entrar')
      .send({ login: 'lia', senha: 'senha-bem-longa', codigoTotp: '000000' });
    expect(ruim.status).toBe(403);
    expect(JSON.stringify(ruim.body)).not.toContain('promo');
    expect(String(ruim.body.erros[0].mensagem)).toContain('entrar');
    const codigo = codigoNoPasso(segredo, passoAtual());
    const comCodigo = await request(app.getHttpServer())
      .post('/v1/auth/entrar')
      .send({ login: 'lia', senha: 'senha-bem-longa', codigoTotp: codigo });
    expect(comCodigo.status).toBe(201);
    expect(comCodigo.body.dados.token).toBeTruthy();
  });

  it('encerra a sessão no servidor e troca a senha com auditoria sem gravar a senha', async () => {
    const entrada = await request(app.getHttpServer())
      .post('/v1/auth/entrar')
      .send({ login: 'erico', senha: 'senha-bem-longa' });
    expect(entrada.body.dados.precisaInscreverTotp).toBe(true);
    const token = entrada.body.dados.token as string;
    const segunda = await request(app.getHttpServer())
      .post('/v1/auth/entrar')
      .send({ login: 'erico', senha: 'senha-bem-longa' });
    const token2 = segunda.body.dados.token as string;
    const curta = await request(app.getHttpServer())
      .post('/v1/auth/senha')
      .set('authorization', `Bearer ${token}`)
      .send({ senhaAtual: 'senha-bem-longa', senhaNova: 'curta' });
    expect(curta.status).toBe(422);
    const trocada = await request(app.getHttpServer())
      .post('/v1/auth/senha')
      .set('authorization', `Bearer ${token}`)
      .send({ senhaAtual: 'senha-bem-longa', senhaNova: 'senha-ainda-maior' });
    expect(trocada.status).toBe(200);
    expect(trocada.body.dados.outrasSessoesEncerradas).toBeGreaterThan(0);
    const outra = await request(app.getHttpServer())
      .get('/v1/auth/eu')
      .set('authorization', `Bearer ${token2}`);
    expect(outra.status).toBe(403);
    const atual = await request(app.getHttpServer())
      .get('/v1/auth/eu')
      .set('authorization', `Bearer ${token}`);
    expect(atual.status).toBe(200);
    const trilha = app.get<Model<{ evento: string }>>(getModelToken('AuthAuditoria'));
    const linha = await trilha.findOne({ evento: 'troca_senha' }).lean();
    expect(linha?.evento).toBe('troca_senha');
    expect(JSON.stringify(linha)).not.toContain('senha-ainda-maior');
    expect(JSON.stringify(linha)).not.toContain('senha-bem-longa');
    const sair = await request(app.getHttpServer())
      .post('/v1/auth/sair')
      .set('authorization', `Bearer ${token}`);
    expect(sair.status).toBe(200);
    const eu = await request(app.getHttpServer())
      .get('/v1/auth/eu')
      .set('authorization', `Bearer ${token}`);
    expect(eu.status).toBe(403);
    const antiga = await request(app.getHttpServer())
      .post('/v1/auth/entrar')
      .send({ login: 'erico', senha: 'senha-bem-longa' });
    expect(antiga.status).toBe(401);
    const nova = await request(app.getHttpServer())
      .post('/v1/auth/entrar')
      .send({ login: 'erico', senha: 'senha-ainda-maior' });
    expect(nova.status).toBe(201);
  });
});
