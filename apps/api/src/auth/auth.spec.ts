import { INestApplication } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { ContatosModule } from '../contatos/contatos.module';
import { AuthModule } from './auth.module';
import { AuthService } from './auth.service';

describe('login de produção', () => {
  let app: INestApplication;
  let memoria: MongoMemoryServer;
  const anterior = process.env.NODE_ENV;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    memoria = await MongoMemoryServer.create();
    const modulo = await Test.createTestingModule({
      imports: [MongooseModule.forRoot(memoria.getUri()), AuthModule, ContatosModule],
    }).compile();
    app = modulo.createNestApplication();
    await app.init();
    await app.get(AuthService).criarUsuario('erico', 'senha-bem-longa', 'Erico', 'admin');
  });

  afterAll(async () => {
    process.env.NODE_ENV = anterior;
    await app.close();
    await memoria.stop();
  });

  it('abre sessão com senha e ignora cabeçalho de teste em production', async () => {
    const ruim = await request(app.getHttpServer())
      .post('/v1/auth/entrar')
      .send({ login: 'erico', senha: 'senha-errada-demais' });
    expect(ruim.status).toBe(401);
    const bom = await request(app.getHttpServer())
      .post('/v1/auth/entrar')
      .send({ login: 'erico', senha: 'senha-bem-longa' });
    expect(bom.status).toBe(201);
    const token = bom.body.dados.token as string;
    process.env.NODE_ENV = 'production';
    process.env.CAPTURA7_HEADERS_TESTE = '1';
    const cabecalho = await request(app.getHttpServer()).get('/v1/auth/eu').set({
      'x-papel-teste': 'admin',
      'x-usuario-id': '507f1f77bcf86cd799439011',
      'x-autor-nome': 'Falsificado',
    });
    expect(cabecalho.status).toBe(403);
    const eu = await request(app.getHttpServer())
      .get('/v1/auth/eu')
      .set('authorization', `Bearer ${token}`);
    expect(eu.status).toBe(200);
    expect(eu.body.dados.papel).toBe('admin');
    expect(eu.body.dados.nome).toBe('Erico');
    process.env.NODE_ENV = 'test';
    delete process.env.CAPTURA7_HEADERS_TESTE;
  });
});
