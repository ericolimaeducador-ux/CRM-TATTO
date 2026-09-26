import { randomBytes } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Types } from 'mongoose';
import request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
import { ContatosModule } from '../src/contatos/contatos.module';

const VENDEDOR = new Types.ObjectId().toHexString();

describe('headers de teste fechados em development', () => {
  let app: INestApplication;
  let memoria: MongoMemoryServer;
  const ambiente = process.env.NODE_ENV;
  const flag = process.env.CAPTURA7_HEADERS_TESTE;

  beforeAll(async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.CAPTURA7_HEADERS_TESTE;
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
    if (ambiente === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = ambiente;
    if (flag === undefined) delete process.env.CAPTURA7_HEADERS_TESTE;
    else process.env.CAPTURA7_HEADERS_TESTE = flag;
    await app.close();
    await memoria.stop();
  });

  it('ignora os cabeçalhos sem a flag e passa a honrá-los quando ela vale 1', async () => {
    expect(process.env.NODE_ENV).toBe('development');
    expect(process.env.CAPTURA7_HEADERS_TESTE).toBeUndefined();
    const fechado = await request(app.getHttpServer())
      .post('/v1/contatos')
      .set(cabecalho())
      .send({ nome: 'Não deveria gravar' });
    expect(fechado.status).toBe(403);
    expect(JSON.stringify(fechado.body)).toContain('PAPEL_INSUFICIENTE');
    expect(JSON.stringify(fechado.body)).not.toContain('Não deveria gravar');

    process.env.CAPTURA7_HEADERS_TESTE = '1';
    const aberto = await request(app.getHttpServer())
      .post('/v1/contatos')
      .set(cabecalho())
      .send({ nome: 'Com a flag' });
    expect(aberto.status).toBe(201);
    expect(aberto.body.dados.nome).toBe('Com A Flag');

    delete process.env.CAPTURA7_HEADERS_TESTE;
    const deNovo = await request(app.getHttpServer())
      .post('/v1/contatos')
      .set({ ...cabecalho(), 'x-step-up-teste': '1' })
      .send({ nome: 'Ainda fechado' });
    expect(deNovo.status).toBe(403);
    expect(JSON.stringify(deNovo.body)).toContain('PAPEL_INSUFICIENTE');

    process.env.NODE_ENV = 'production';
    process.env.CAPTURA7_HEADERS_TESTE = '1';
    const producao = await request(app.getHttpServer())
      .post('/v1/contatos')
      .set({ ...cabecalho(), 'x-step-up-teste': '1' })
      .send({ nome: 'Produção com flag' });
    expect(producao.status).toBe(403);
    expect(JSON.stringify(producao.body)).toContain('PAPEL_INSUFICIENTE');
    expect(JSON.stringify(producao.body)).not.toContain('Produção com flag');
  });
});

function cabecalho(): Record<string, string> {
  return {
    'x-papel-teste': 'vendedor',
    'x-usuario-id': VENDEDOR,
    'x-autor-nome': 'Não deveria valer',
  };
}
