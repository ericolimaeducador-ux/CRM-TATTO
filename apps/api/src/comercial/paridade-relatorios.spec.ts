import { randomBytes } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { Model } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { AuthModule } from '../auth/auth.module';
import { ContatosModule } from '../contatos/contatos.module';
import { ComercialModule } from './comercial.module';
import type { DocumentoComercial, TipoComercial } from './comercial.schema';

const ANA = '507f1f77bcf86cd799439111';
const BIA = '507f1f77bcf86cd799439112';
const headers = {
  'x-papel-teste': 'vendedor',
  'x-usuario-id': ANA,
  'x-autor-nome': 'QA de calendário',
};
// 16/11 às 23:30 em São Paulo e 17/11 exatamente à meia-noite local.
const NOITE_16 = '2026-11-17T02:30:00.000Z';
const INICIO_17 = '2026-11-17T03:00:00.000Z';
function documento(
  tipo: TipoComercial,
  campos: Record<string, unknown>,
  criadoEm = NOITE_16,
  donoId = ANA,
) {
  return {
    tipo,
    campos,
    donoId,
    versao: 1,
    arquivado: false,
    criadoEm: new Date(criadoEm),
    alteradoEm: new Date(criadoEm),
    criadoPor: donoId,
    alteradoPor: donoId,
    auditoria: [],
  };
}

describe('TV-18 — relatórios por dia civil de São Paulo', () => {
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
  });
  beforeEach(async () => {
    await registros.deleteMany({});
  });
  afterAll(async () => {
    if (app) await app.close();
    if (mongo) await mongo.stop();
    process.env.NODE_ENV = ambienteAnterior;
  });
  async function relatorio(dia: string) {
    const resposta = await request(app.getHttpServer())
      .get(`/v1/comercial/relatorios?de=${dia}&ate=${dia}`)
      .set(headers);
    expect(resposta.status).toBe(200);
    expect(resposta.body.periodo).toMatchObject({ de: dia, ate: dia });
    return resposta.body;
  }

  it('inclui participante criado às 23:30 BRT no dia 16 e reserva 00:00 para o dia 17', async () => {
    await registros.insertMany([
      documento('participantes', {
        nome: 'Participante do dia 16',
        confirmado: true,
        presente: true,
        status: 'presente',
      }),
      documento(
        'participantes',
        { nome: 'Participante do dia 17', confirmado: true, presente: true, status: 'presente' },
        INICIO_17,
      ),
      documento(
        'participantes',
        { nome: 'Outra carteira', presente: true, status: 'presente' },
        NOITE_16,
        BIA,
      ),
    ]);
    const dia16 = await relatorio('2026-11-16');
    expect(dia16.participantes).toEqual({ inscricoes: 1, confirmados: 1, presentes: 1 });
    expect(JSON.stringify(dia16)).not.toContain('Participante do dia');
    const dia17 = await relatorio('2026-11-17');
    expect(dia17.participantes).toEqual({ inscricoes: 1, confirmados: 1, presentes: 1 });
  });

  it('soma os contatos capturados por dia civil de São Paulo, só da carteira do vendedor', async () => {
    const { Types } = await import('mongoose');
    const contatos = registros.db.collection('contatos');
    await contatos.deleteMany({});
    const ana = new Types.ObjectId(ANA);
    const bia = new Types.ObjectId(BIA);
    await contatos.insertMany([
      {
        idLocal: 'loc-1',
        codigo: 'cod-1',
        nome: 'C1',
        criadoEm: new Date(NOITE_16),
        origem: { vendedorAtribuido: ana },
      },
      {
        idLocal: 'loc-2',
        codigo: 'cod-2',
        nome: 'C2',
        criadoEm: new Date(NOITE_16),
        origem: { vendedorAtribuido: ana },
      },
      {
        idLocal: 'loc-3',
        codigo: 'cod-3',
        nome: 'C3',
        criadoEm: new Date(INICIO_17),
        origem: { vendedorAtribuido: ana },
      },
      {
        idLocal: 'loc-4',
        codigo: 'cod-4',
        nome: 'C4',
        criadoEm: new Date(NOITE_16),
        origem: { vendedorAtribuido: bia },
      },
    ]);
    const resposta = await request(app.getHttpServer())
      .get('/v1/comercial/relatorios?de=2026-11-16&ate=2026-11-17')
      .set(headers);
    expect(resposta.status).toBe(200);
    expect(resposta.body.contatos).toEqual({
      total: 3,
      porDia: [
        { dia: '2026-11-16', quantidade: 2 },
        { dia: '2026-11-17', quantidade: 1 },
      ],
    });
    expect(JSON.stringify(resposta.body)).not.toContain('C1');
    await contatos.deleteMany({});
  });

  it('aplica a mesma fronteira à data marcada da atividade, independentemente da criação', async () => {
    await registros.insertMany([
      documento(
        'atividades',
        { titulo: 'Visita do dia 16', tipo: 'visita', status: 'concluida', data: NOITE_16 },
        '2026-11-01T12:00:00Z',
      ),
      documento(
        'atividades',
        { titulo: 'Visita do dia 17', tipo: 'visita', status: 'planejada', data: INICIO_17 },
        '2026-11-01T12:00:00Z',
      ),
    ]);
    const dia16 = await relatorio('2026-11-16');
    expect(dia16.atividades).toMatchObject({
      total: 1,
      porTipo: [{ tipo: 'visita', quantidade: 1 }],
      porStatus: [{ status: 'concluida', quantidade: 1 }],
    });
    const dia17 = await relatorio('2026-11-17');
    expect(dia17.atividades).toMatchObject({
      total: 1,
      porStatus: [{ status: 'planejada', quantidade: 1 }],
    });
  });

  it('usa o calendário local para criação de oportunidades, propostas e treinamentos', async () => {
    await registros.insertMany([
      documento('oportunidades', { titulo: 'Dia 16', etapa: 'proposta', valorCentavos: 12000 }),
      documento('propostas', { titulo: 'Dia 16', status: 'rascunho', totalCentavos: 2500 }),
      documento('treinamentos', { titulo: 'Dia 16', tipo: 'online' }),
      documento(
        'oportunidades',
        { titulo: 'Dia 17', etapa: 'proposta', valorCentavos: 99999 },
        INICIO_17,
      ),
      documento(
        'propostas',
        { titulo: 'Dia 17', status: 'rascunho', totalCentavos: 99999 },
        INICIO_17,
      ),
      documento('treinamentos', { titulo: 'Dia 17', tipo: 'online' }, INICIO_17),
    ]);
    const dia16 = await relatorio('2026-11-16');
    expect(dia16.oportunidades).toMatchObject({ total: 1, pipelineCentavos: 12000 });
    expect(dia16.propostas).toMatchObject({ total: 1, totalCentavos: 2500 });
    expect(dia16.treinamentos).toEqual({ quantidade: 1 });
    const dia17 = await relatorio('2026-11-17');
    expect(dia17.oportunidades).toMatchObject({ total: 1, pipelineCentavos: 99999 });
    expect(dia17.propostas).toMatchObject({ total: 1, totalCentavos: 99999 });
    expect(dia17.treinamentos).toEqual({ quantidade: 1 });
  });
});
