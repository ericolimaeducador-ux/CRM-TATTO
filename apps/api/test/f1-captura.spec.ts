import { randomBytes, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { getConnectionToken, MongooseModule } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Types, type Connection } from 'mongoose';
import request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
import { ContatosModule } from '../src/contatos/contatos.module';
import { garantirIndices } from '../src/contatos/schemas/registrar-modelos';

const GESTOR = new Types.ObjectId().toHexString();
const UM = new Types.ObjectId().toHexString();
const DOIS = new Types.ObjectId().toHexString();
const CPF = '52998224725';

describe('captura da fase 1', () => {
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
    await garantirIndices(app.get<Connection>(getConnectionToken()));
  });

  afterAll(async () => {
    await app.close();
    await memoria.stop();
  });

  it('reenvia o mesmo idLocal três vezes e fica um contato', async () => {
    const idLocal = randomUUID();
    const envios = [];
    for (let i = 0; i < 3; i += 1) {
      envios.push(
        await request(app.getHttpServer())
          .post('/v1/contatos')
          .set(cabecalho())
          .send({ nome: 'Triplo', idLocal }),
      );
    }
    expect(envios.map((item) => item.status)).toEqual([201, 200, 200]);
    expect(new Set(envios.map((item) => item.body.dados._id)).size).toBe(1);
  });

  it('não funde dois vendedores que capturam o mesmo documento ao mesmo tempo', async () => {
    const corpo = { nome: 'Mesmo Lead', telefone: '11988887777', cpf: CPF };
    const [a, b] = await Promise.all([
      request(app.getHttpServer()).post('/v1/contatos').set(cabecalho('vendedor', UM)).send(corpo),
      request(app.getHttpServer())
        .post('/v1/contatos')
        .set(cabecalho('vendedor', DOIS))
        .send(corpo),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 422]);
    expect(JSON.stringify([a.body, b.body])).toContain('CPF_DUPLICADO');
    const lista = await request(app.getHttpServer()).get('/v1/contatos').set(cabecalho('gestor'));
    const achados = lista.body.dados.filter(
      (item: { nome?: string }) => item.nome === 'Mesmo Lead',
    );
    expect(achados).toHaveLength(2);
    expect(achados.map((item: { status: string }) => item.status).sort()).toEqual([
      'capturado',
      'rascunho',
    ]);
  });

  it('dispara a promoção a qualificado duas vezes e audita uma', async () => {
    const criado = await request(app.getHttpServer())
      .post('/v1/contatos')
      .set(cabecalho('gestor'))
      .send({
        nome: 'Promo Dupla',
        telefone: '11977776666',
        email: 'promo@exemplo.com',
        cpf: '39053344705',
      });
    expect(criado.body.dados.status).toBe('capturado');
    const id = criado.body.dados._id as string;
    const [um, dois] = await Promise.all([
      request(app.getHttpServer())
        .post(`/v1/contatos/${id}/transicao`)
        .set(cabecalho('gestor'))
        .send({ para: 'qualificado' }),
      request(app.getHttpServer())
        .post(`/v1/contatos/${id}/transicao`)
        .set(cabecalho('gestor'))
        .send({ para: 'qualificado' }),
    ]);
    expect([um.status, dois.status].sort()).toEqual([201, 422]);
    expect(JSON.stringify([um.body, dois.body])).toContain('CONFLITO_VERSAO');
    const lido = await request(app.getHttpServer())
      .get(`/v1/contatos/${id}`)
      .set(cabecalho('gestor'));
    expect(lido.body.dados.status).toBe('qualificado');
    const trilha = await request(app.getHttpServer())
      .get(`/v1/contatos/${id}/auditoria`)
      .set(cabecalho('gestor'));
    const status = trilha.body.dados.filter((linha: { campo: string }) => linha.campo === 'status');
    expect(status).toHaveLength(1);
    expect(status[0].valorAnterior).toBe('capturado');
    expect(status[0].valorNovo).toBe('qualificado');
    expect(status[0].autor).toBe(GESTOR);
  });

  it('nega cliente sem step-up e não abre rota de exportação', async () => {
    const criado = await request(app.getHttpServer())
      .post('/v1/contatos')
      .set(cabecalho('gestor'))
      .send({
        nome: 'Quase Cliente',
        telefone: '11966665555',
        email: 'quase@exemplo.com',
        cpf: '15350946056',
        logradouro: 'Rua A',
        numero: '10',
        cidade: 'São Paulo',
        uf: 'SP',
      });
    const id = criado.body.dados._id as string;
    const qualificado = await request(app.getHttpServer())
      .post(`/v1/contatos/${id}/transicao`)
      .set(cabecalho('gestor'))
      .send({ para: 'qualificado' });
    expect(qualificado.status).toBe(201);
    const semCodigo = await request(app.getHttpServer())
      .post(`/v1/contatos/${id}/transicao`)
      .set(cabecalho('gestor'))
      .send({ para: 'cliente' });
    expect(semCodigo.status).toBe(403);
    expect(JSON.stringify(semCodigo.body)).toContain('STEP_UP_NECESSARIO');
    const ainda = await request(app.getHttpServer())
      .get(`/v1/contatos/${id}`)
      .set(cabecalho('gestor'));
    expect(ainda.body.dados.status).toBe('qualificado');
    const exportacao = await request(app.getHttpServer())
      .get('/v1/exportacoes')
      .set(cabecalho('gestor'));
    expect(exportacao.status).toBe(404);
  });

  it('não oferece exclusão física nem alteração da trilha', async () => {
    const criado = await request(app.getHttpServer())
      .post('/v1/contatos')
      .set(cabecalho())
      .send({ nome: 'Permanece' });
    const id = criado.body.dados._id as string;
    const apagado = await request(app.getHttpServer())
      .delete(`/v1/contatos/${id}`)
      .set(cabecalho());
    expect(apagado.status).toBe(404);
    const trilha = await request(app.getHttpServer())
      .patch(`/v1/contatos/${id}/auditoria`)
      .set(cabecalho('gestor'))
      .send({ valorNovo: 'trocado' });
    expect(trilha.status).toBe(404);
    const segue = await request(app.getHttpServer()).get(`/v1/contatos/${id}`).set(cabecalho());
    expect(segue.body.dados.nome).toBe('Permanece');
  });
});

function cabecalho(papel = 'vendedor', id = GESTOR): Record<string, string> {
  return {
    'x-papel-teste': papel,
    'x-usuario-id': id,
    'x-autor-nome': 'Sessão da fase 1',
  };
}
