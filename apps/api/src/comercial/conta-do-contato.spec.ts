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

const GESTOR = '507f1f77bcf86cd799439201';
const VENDEDOR = '507f1f77bcf86cd799439202';
const OUTRO = '507f1f77bcf86cd799439203';
const head = (papel = 'gestor', id = papel === 'vendedor' ? VENDEDOR : GESTOR) => ({
  'x-papel-teste': papel,
  'x-usuario-id': id,
  'x-autor-nome': 'QA carteira',
});

describe('ADR-028 — conta da carteira nasce do contato qualificado', () => {
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
    await registros.syncIndexes();
    await registros.db.collection('usuarios').insertMany(
      [
        [GESTOR, 'gestor'],
        [VENDEDOR, 'vendedor'],
        [OUTRO, 'vendedor'],
      ].map(([id, papel]) => ({
        _id: new Types.ObjectId(id),
        login: `qa-${id.slice(-3)}`,
        nome: `QA ${papel}`,
        papel,
        ativo: true,
        senhaHash: 'fixture-sem-login',
        criadoEm: new Date(),
      })),
    );
  });
  beforeEach(async () => {
    await registros.deleteMany({});
    await registros.db.collection('contatos').deleteMany({});
  });
  afterAll(async () => {
    if (app) await app.close();
    if (mongo) await mongo.stop();
    process.env.NODE_ENV = ambienteAnterior;
  });
  const api = () => request(app.getHttpServer());
  const contas = () => registros.find({ tipo: 'contas' }).lean();

  async function lead(dados: Record<string, unknown> = {}) {
    const r = await api()
      .post('/v1/contatos')
      .set(head())
      .send({
        nome: 'Estúdio Agulha Fina',
        telefone: '11955554444',
        email: 'agulha@exemplo.com',
        cidade: 'Campinas',
        uf: 'SP',
        tipoPessoa: 'PJ',
        ...dados,
      });
    expect(r.status).toBe(201);
    return r.body.dados as { _id: string; versao: number };
  }
  const transicao = (id: string, para: string, motivo?: string) =>
    api().post(`/v1/contatos/${id}/transicao`).set(head()).send({ para, motivo });

  it('não cria conta para lead capturado; qualificar cria uma só, espelhando a ficha', async () => {
    const c = await lead();
    expect(await contas()).toHaveLength(0);
    expect((await transicao(c._id, 'qualificado')).status).toBe(201);
    const [conta, ...resto] = await contas();
    expect(resto).toHaveLength(0);
    expect(conta.campos).toMatchObject({
      contatoOrigemId: c._id,
      nome: 'Estúdio Agulha Fina',
      contatoEmail: 'agulha@exemplo.com',
      cidade: 'Campinas',
      uf: 'SP',
      segmento: 'estudio_tatuagem',
      status: 'prospect',
      classificacao: 'B',
    });
    expect(String(conta.campos.contatoTelefone)).toContain('5511955554444');
    expect(conta.donoId).toBe(GESTOR);
    expect(conta.auditoria[0].acao).toBe('criar_do_contato');
    expect(JSON.stringify(conta.auditoria)).not.toContain(GESTOR);
  });

  it('editar a ficha atualiza a conta sem perder campos comerciais; responsável vira dono', async () => {
    const c = await lead({ nome: 'Tatuador Solo', tipoPessoa: 'PF' });
    await transicao(c._id, 'qualificado');
    const [conta] = await contas();
    expect(conta.campos.segmento).toBe('profissional_autonomo');
    // Campo só comercial, editado na conta, sobrevive à sincronização.
    const editada = await api()
      .patch(`/v1/comercial/contas/${String(conta._id)}`)
      .set(head())
      .send({ versao: conta.versao, classificacao: 'A', proximaAcao: 'Levar amostras' });
    expect(editada.status).toBe(200);
    const lido = await api().get(`/v1/contatos/${c._id}`).set(head());
    const r = await api()
      .patch(`/v1/contatos/${c._id}`)
      .set(head())
      .send({ campo: 'cidade', valor: 'Sorocaba', versaoConhecida: lido.body.dados.versao });
    expect(r.status).toBe(200);
    let [depois] = await contas();
    expect(depois.campos).toMatchObject({
      cidade: 'Sorocaba',
      classificacao: 'A',
      proximaAcao: 'Levar amostras',
    });
    expect(depois.auditoria.at(-1)?.acao).toBe('sincronizar_contato');
    expect(depois.auditoria.at(-1)?.campos).toEqual(['cidade']);
    // Representante não vê a conta até ela ser passada para ele.
    const antes = await api().get('/v1/comercial/contas').set(head('vendedor'));
    expect(JSON.stringify(antes.body)).not.toContain('Tatuador Solo');
    expect(
      (
        await api()
          .post('/v1/contatos/atribuir')
          .set(head())
          .send({ ids: [c._id], responsavelId: VENDEDOR })
      ).status,
    ).toBeLessThan(300);
    [depois] = await contas();
    expect(depois.donoId).toBe(VENDEDOR);
    const agora = await api().get('/v1/comercial/contas').set(head('vendedor'));
    expect(JSON.stringify(agora.body)).toContain('Tatuador Solo');
  });

  it('descartar arquiva a conta e reabrir/qualificar de novo restaura a mesma', async () => {
    const c = await lead({ nome: 'Estúdio Volta' });
    await transicao(c._id, 'qualificado');
    const [conta] = await contas();
    expect((await transicao(c._id, 'descartado', 'Sem interesse agora')).status).toBe(201);
    let [depois] = await contas();
    expect(depois.arquivado).toBe(true);
    expect(depois.auditoria.at(-1)?.acao).toBe('arquivar_do_contato');
    await transicao(c._id, 'capturado');
    await transicao(c._id, 'qualificado');
    const todas = await contas();
    expect(todas).toHaveLength(1);
    [depois] = todas;
    expect(String(depois._id)).toBe(String(conta._id));
    expect(depois.arquivado).toBe(false);
  });
});
