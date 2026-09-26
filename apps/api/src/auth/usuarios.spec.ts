import { randomBytes } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { ContatosModule } from '../contatos/contatos.module';
import { AuthModule } from './auth.module';
import { AuthService } from './auth.service';
import { codigoNoPasso, passoAtual } from './totp-rfc6238';

describe('gestão de usuários', () => {
  let app: INestApplication;
  let memoria: MongoMemoryServer;
  let token = '';

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
    await app.get(AuthService).criarUsuario('erico', 'senha-bem-longa', 'Erico', 'admin');
    const entrada = await request(app.getHttpServer())
      .post('/v1/auth/entrar')
      .send({ login: 'erico', senha: 'senha-bem-longa' });
    token = entrada.body.dados.token as string;
  });

  afterAll(async () => {
    await app.close();
    await memoria.stop();
  });

  it('cria, recusa papel e login repetido, muda perfil com TOTP e desativa', async () => {
    const criado = await request(app.getHttpServer())
      .post('/v1/usuarios')
      .set(auth())
      .send({ login: 'ana', senha: 'senha-bem-longa', nome: 'Ana', papel: 'vendedor' });
    expect(criado.status).toBe(201);
    expect(criado.body.dados.papel).toBe('vendedor');
    const id = criado.body.dados.id as string;

    const papelRuim = await request(app.getHttpServer())
      .post('/v1/usuarios')
      .set(auth())
      .send({ login: 'outro', senha: 'senha-bem-longa', nome: 'Outro', papel: 'chefe' });
    expect(papelRuim.status).toBe(422);
    expect(JSON.stringify(papelRuim.body)).toContain('PAPEL_INVALIDO');

    const repetido = await request(app.getHttpServer())
      .post('/v1/usuarios')
      .set(auth())
      .send({ login: 'ana', senha: 'outra-senha-longa', nome: 'Ana 2', papel: 'gestor' });
    expect(repetido.status).toBe(422);
    expect(JSON.stringify(repetido.body)).toContain('LOGIN_EXISTENTE');

    const semPasso = await request(app.getHttpServer())
      .patch(`/v1/usuarios/${id}`)
      .set(auth())
      .send({ papel: 'gestor' });
    expect(semPasso.status).toBe(403);
    expect(JSON.stringify(semPasso.body)).toContain('STEP_UP_NECESSARIO');

    const inscricao = await request(app.getHttpServer())
      .post('/v1/auth/totp/inscrever')
      .set(auth())
      .send({});
    expect(inscricao.status).toBe(201);
    const codigo = codigoNoPasso(inscricao.body.dados.segredoBase32 as string, passoAtual());
    const passo = await request(app.getHttpServer())
      .post('/v1/auth/step-up')
      .set(auth())
      .send({ codigoTotp: codigo });
    expect(passo.status).toBe(201);

    const perfil = await request(app.getHttpServer())
      .patch(`/v1/usuarios/${id}`)
      .set(auth())
      .send({ papel: 'auditor' });
    expect(perfil.status).toBe(200);
    expect(perfil.body.dados.papel).toBe('auditor');

    const zerado = await request(app.getHttpServer())
      .post(`/v1/usuarios/${id}/totp/zerar`)
      .set(auth())
      .send({});
    expect(zerado.status).toBe(201);
    expect(zerado.body.dados.totp).toBe('zerado');

    const off = await request(app.getHttpServer())
      .patch(`/v1/usuarios/${id}`)
      .set(auth())
      .send({ ativo: false });
    expect(off.status).toBe(200);
    const login = await request(app.getHttpServer())
      .post('/v1/auth/entrar')
      .send({ login: 'ana', senha: 'senha-bem-longa' });
    expect(login.status).toBe(401);
  });

  function auth(): Record<string, string> {
    return { authorization: `Bearer ${token}` };
  }
});
