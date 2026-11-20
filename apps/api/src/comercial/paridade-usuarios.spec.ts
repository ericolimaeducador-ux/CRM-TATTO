import { randomBytes } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types, type Model } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { AuthModule } from '../auth/auth.module';
import { ContatosModule } from '../contatos/contatos.module';
import { ComercialModule } from './comercial.module';
import type { DocumentoComercial } from './comercial.schema';

const IDS = {
  vendedor: '507f1f77bcf86cd799439101',
  gestor: '507f1f77bcf86cd799439102',
  admin: '507f1f77bcf86cd799439103',
  inativo: '507f1f77bcf86cd799439104',
  auditor: '507f1f77bcf86cd799439105',
  inexistente: '507f1f77bcf86cd799439106',
};
const headers = {
  'x-papel-teste': 'vendedor',
  'x-usuario-id': IDS.vendedor,
  'x-autor-nome': 'QA de atribuição',
};
const invalidos = (['inexistente', 'inativo', 'auditor'] as const).flatMap((caso) =>
  (['responsavelId', 'colaboradoresIds'] as const).map((campo) => ({ caso, campo, id: IDS[caso] })),
);

describe('TV-17 — atribuição de atividades para equipe ativa', () => {
  let app: INestApplication;
  let mongo: MongoMemoryServer;
  let registros: Model<DocumentoComercial>;
  const ambienteAnterior = process.env.NODE_ENV;
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.CIFRA_CHAVE_BASE64 = randomBytes(32).toString('base64');
    process.env.CIFRA_PEPPER = randomBytes(32).toString('hex');
    mongo = await MongoMemoryServer.create();
    const modulo = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongo.getUri()),
        AuthModule,
        ContatosModule,
        ComercialModule,
      ],
    }).compile();
    app = modulo.createNestApplication();
    await app.init();
    registros = app.get<Model<DocumentoComercial>>(getModelToken('Comercial'));
    await registros.db.collection('usuarios').insertMany(
      (['vendedor', 'gestor', 'admin', 'inativo', 'auditor'] as const).map((caso) => ({
        _id: new Types.ObjectId(IDS[caso]),
        login: `qa-${caso}`,
        nome: `QA ${caso}`,
        papel: caso === 'inativo' ? 'vendedor' : caso,
        ativo: caso !== 'inativo',
        senhaHash: 'fixture-sem-login',
        criadoEm: new Date(),
      })),
    );
  });
  beforeEach(async () => {
    await registros.deleteMany({});
  });
  afterAll(async () => {
    if (app) await app.close();
    if (mongo) await mongo.stop();
    process.env.NODE_ENV = ambienteAnterior;
  });

  it.each(['vendedor', 'gestor', 'admin'] as const)(
    'POST aceita responsável %s ativo e deduplica colaboradores',
    async (papel) => {
      const criado = await request(app.getHttpServer())
        .post('/v1/comercial/atividades')
        .set(headers)
        .send({
          titulo: 'Atividade QA',
          responsavelId: IDS[papel],
          colaboradoresIds: [IDS.vendedor, IDS.gestor, IDS.vendedor],
        });
      expect(criado.status).toBe(201);
      expect(criado.body.registro).toMatchObject({
        responsavelId: IDS[papel],
        colaboradoresIds: [IDS.vendedor, IDS.gestor],
        versao: 1,
      });
    },
  );

  it.each(invalidos)('POST rejeita $caso em $campo sem criar registro', async ({ campo, id }) => {
    const corpo = {
      titulo: 'Atividade inválida QA',
      [campo]: campo === 'colaboradoresIds' ? [IDS.vendedor, id] : id,
    };
    const resposta = await request(app.getHttpServer())
      .post('/v1/comercial/atividades')
      .set(headers)
      .send(corpo);
    expect(resposta.status).toBe(422);
    expect(await registros.countDocuments({ tipo: 'atividades' })).toBe(0);
  });

  it.each(['vendedor', 'gestor', 'admin'] as const)(
    'PATCH aceita responsável %s ativo e deduplica colaboradores',
    async (papel) => {
      const criado = await request(app.getHttpServer())
        .post('/v1/comercial/atividades')
        .set(headers)
        .send({ titulo: 'Atividade QA' });
      expect(criado.status).toBe(201);
      const atualizado = await request(app.getHttpServer())
        .patch(`/v1/comercial/atividades/${criado.body.registro._id}`)
        .set(headers)
        .send({
          versao: 1,
          responsavelId: IDS[papel],
          colaboradoresIds: [IDS.admin, IDS.gestor, IDS.admin],
        });
      expect(atualizado.status).toBe(200);
      expect(atualizado.body.registro).toMatchObject({
        responsavelId: IDS[papel],
        colaboradoresIds: [IDS.admin, IDS.gestor],
        versao: 2,
      });
    },
  );

  it.each(invalidos)(
    'PATCH rejeita $caso em $campo sem sobrescrever atribuição ou versão',
    async ({ campo, id }) => {
      const criado = await request(app.getHttpServer())
        .post('/v1/comercial/atividades')
        .set(headers)
        .send({
          titulo: 'Atividade QA',
          responsavelId: IDS.vendedor,
          colaboradoresIds: [IDS.gestor],
        });
      expect(criado.status).toBe(201);
      const atualizado = await request(app.getHttpServer())
        .patch(`/v1/comercial/atividades/${criado.body.registro._id}`)
        .set(headers)
        .send({ versao: 1, [campo]: campo === 'colaboradoresIds' ? [IDS.vendedor, id] : id });
      expect(atualizado.status).toBe(422);
      const preservado = await request(app.getHttpServer())
        .get(`/v1/comercial/atividades/${criado.body.registro._id}`)
        .set(headers);
      expect(preservado.status).toBe(200);
      expect(preservado.body.registro).toMatchObject({
        responsavelId: IDS.vendedor,
        colaboradoresIds: [IDS.gestor],
        versao: 1,
      });
      const documento = await registros.findById(criado.body.registro._id).lean();
      expect(documento?.auditoria).toHaveLength(1);
    },
  );
});
