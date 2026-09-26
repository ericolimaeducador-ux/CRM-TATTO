import { randomBytes } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Types } from 'mongoose';
import request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
import { ContatosModule } from '../src/contatos/contatos.module';

const GESTOR = new Types.ObjectId().toHexString();

describe('atalho de step-up em produção', () => {
  let app: INestApplication;
  let memoria: MongoMemoryServer;
  const ambienteAnterior = process.env.NODE_ENV;
  const flagAnterior = process.env.CAPTURA7_HEADERS_TESTE;

  beforeAll(async () => {
    process.env.NODE_ENV = 'production';
    process.env.CAPTURA7_HEADERS_TESTE = '1';
    process.env.CIFRA_CHAVE_BASE64 = randomBytes(32).toString('base64');
    process.env.CIFRA_PEPPER = randomBytes(32).toString('hex');
    memoria = await MongoMemoryServer.create();
    const modulo = await Test.createTestingModule({
      imports: [MongooseModule.forRoot(memoria.getUri()), AuthModule, ContatosModule],
    }).compile();
    app = modulo.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    process.env.NODE_ENV = ambienteAnterior;
    if (flagAnterior === undefined) delete process.env.CAPTURA7_HEADERS_TESTE;
    else process.env.CAPTURA7_HEADERS_TESTE = flagAnterior;
    await app.close();
    await memoria.stop();
  });

  it('ignora o cabeçalho de teste em production mesmo com a flag', async () => {
    expect(process.env.NODE_ENV).toBe('production');
    expect(process.env.CAPTURA7_HEADERS_TESTE).toBe('1');
    const transicao = await request(app.getHttpServer())
      .post(`/v1/contatos/${new Types.ObjectId().toHexString()}/transicao`)
      .set({
        'x-papel-teste': 'gestor',
        'x-usuario-id': GESTOR,
        'x-autor-nome': 'Não deveria valer',
        'x-step-up-teste': '1',
      })
      .send({ para: 'cliente', codigoTotp: '123456' });
    expect(transicao.status).toBe(403);
    expect(JSON.stringify(transicao.body)).toContain('PAPEL_INSUFICIENTE');
    expect(JSON.stringify(transicao.body)).not.toContain('"status":"cliente"');

    const inscricao = await request(app.getHttpServer()).post('/v1/auth/totp/inscrever').set({
      'x-papel-teste': 'admin',
      'x-usuario-id': GESTOR,
      'x-step-up-teste': '1',
    });
    expect(inscricao.status).toBe(403);
    expect(JSON.stringify(inscricao.body)).toContain('PAPEL_INSUFICIENTE');
  });
});
