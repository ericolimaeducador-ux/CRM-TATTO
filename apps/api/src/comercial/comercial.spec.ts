import { randomBytes } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Model } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { AuthModule } from '../auth/auth.module';
import { ContatosModule } from '../contatos/contatos.module';
import { ComercialModule } from './comercial.module';
import type { DocumentoComercial } from './comercial.schema';

const ANA = '507f1f77bcf86cd799439011';
const BIA = '507f1f77bcf86cd799439012';
const GESTOR = '507f1f77bcf86cd799439013';
function headers(papel = 'vendedor', id = ANA) {
  return { 'x-papel-teste': papel, 'x-usuario-id': id, 'x-autor-nome': 'Teste' };
}
describe('Tela Viva — comercial HTTP', () => {
  let app: INestApplication;
  let mongo: MongoMemoryServer;
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
  });
  afterAll(async () => {
    await app.close();
    await mongo.stop();
  });
  it('fecha acesso anônimo, isola carteiras e não aceita autoria ou auditoria do cliente', async () => {
    expect((await request(app.getHttpServer()).get('/v1/comercial/contas')).status).toBe(403);
    const criado = await request(app.getHttpServer())
      .post('/v1/comercial/contas')
      .set(headers())
      .send({
        nome: 'Hospital Teste',
        classificacao: 'A',
        donoId: BIA,
        criadoPor: BIA,
        auditoria: [],
        versao: 300,
      });
    expect(criado.status).toBe(201);
    const doc = criado.body.registro;
    expect(doc.donoId).toBe(ANA);
    expect(doc.criadoPor).toBe(ANA);
    expect(doc.versao).toBe(1);
    expect(
      (
        await request(app.getHttpServer())
          .get(`/v1/comercial/contas/${doc._id}`)
          .set(headers('vendedor', BIA))
      ).status,
    ).toBe(404);
    const lista = await request(app.getHttpServer())
      .get('/v1/comercial/contas')
      .set(headers('vendedor', BIA));
    expect(lista.body.total).toBe(0);
    const gestor = await request(app.getHttpServer())
      .get('/v1/comercial/contas')
      .set(headers('gestor', GESTOR));
    expect(gestor.body.total).toBe(1);
    const trilha = await request(app.getHttpServer())
      .get(`/v1/comercial/contas/${doc._id}/auditoria`)
      .set(headers());
    expect(trilha.body.eventos).toHaveLength(1);
    expect(trilha.body.eventos[0].versao).toBe(1);
    expect(JSON.stringify(trilha.body)).not.toContain('Hospital Teste');
    expect(trilha.body.eventos[0].autor).not.toBe(ANA);
    const contatoAudit = app.get<Model<unknown>>(getModelToken('ContatoAuditoria'));
    expect(await contatoAudit.countDocuments()).toBe(0);
  });
  it('concorre com versão e arquiva logicamente com trilha atômica', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/comercial/contas')
      .set(headers())
      .send({});
    expect(res.status).toBe(201);
    const id = res.body.registro._id;
    const salvos = await Promise.all([
      request(app.getHttpServer())
        .patch(`/v1/comercial/contas/${id}`)
        .set(headers())
        .send({ versao: 1, nome: 'Primeiro' }),
      request(app.getHttpServer())
        .patch(`/v1/comercial/contas/${id}`)
        .set(headers())
        .send({ versao: 1, nome: 'Segundo' }),
    ]);
    expect(salvos.map((r) => r.status).sort()).toEqual([200, 409]);
    const arquivado = await request(app.getHttpServer())
      .patch(`/v1/comercial/contas/${id}`)
      .set(headers())
      .send({ versao: 2, arquivado: true, auditoria: [] });
    expect(arquivado.status).toBe(200);
    expect(arquivado.body.registro.versao).toBe(3);
    const modelo = app.get<Model<DocumentoComercial>>(getModelToken('Comercial'));
    const doc = await modelo.findById(id).lean();
    expect(doc?.arquivado).toBe(true);
    expect(doc?.auditoria.map((e) => e.versao)).toEqual([1, 2, 3]);
    expect(
      (
        await request(app.getHttpServer())
          .get('/v1/comercial/contas?arquivados=true')
          .set(headers())
      ).body.total,
    ).toBe(1);
    expect(
      (
        await request(app.getHttpServer())
          .patch(`/v1/comercial/contas/${id}`)
          .set(headers('auditor', GESTOR))
          .send({ versao: 3, nome: 'Não' })
      ).status,
    ).toBe(403);
  });
  it('calcula proposta em centavos e valida produtos/referências de carteira', async () => {
    const conta = (
      await request(app.getHttpServer())
        .post('/v1/comercial/contas')
        .set(headers())
        .send({ nome: 'Clínica' })
    ).body.registro;
    expect(
      (
        await request(app.getHttpServer())
          .post('/v1/comercial/produtos')
          .set(headers())
          .send({ nome: 'Produto' })
      ).status,
    ).toBe(403);
    const produto = (
      await request(app.getHttpServer())
        .post('/v1/comercial/produtos')
        .set(headers('gestor', GESTOR))
        .send({ nome: 'Luva', categoria: 'material', precoCentavos: 1000 })
    ).body.registro;
    const proposta = await request(app.getHttpServer())
      .post('/v1/comercial/propostas')
      .set(headers())
      .send({
        contaId: conta._id,
        totalCentavos: 1,
        itens: [
          {
            produtoId: produto._id,
            descricao: 'Luva',
            quantidade: 3,
            precoUnitarioCentavos: 1099,
            descontoPercentual: 10,
          },
        ],
      });
    expect(proposta.status).toBe(201);
    expect(proposta.body.registro.subtotalCentavos).toBe(3297);
    expect(proposta.body.registro.descontoCentavos).toBe(330);
    expect(proposta.body.registro.totalCentavos).toBe(2967);
    const outraCarteira = await request(app.getHttpServer())
      .post('/v1/comercial/atividades')
      .set(headers('vendedor', BIA))
      .send({ contaId: conta._id, tipo: 'visita' });
    expect(outraCarteira.status).toBe(404);
    const visitaGestao = await request(app.getHttpServer())
      .post('/v1/comercial/atividades')
      .set(headers('gestor', GESTOR))
      .send({ contaId: conta._id, tipo: 'visita', data: new Date().toISOString() });
    expect(visitaGestao.status).toBe(201);
    expect(visitaGestao.body.registro.donoId).toBe(ANA);
    expect(visitaGestao.body.registro.tipo).toBe('visita');
    expect(visitaGestao.body.registro.secao).toBe('atividades');
    expect(
      (
        await request(app.getHttpServer())
          .post('/v1/comercial/propostas')
          .set(headers())
          .send({ itens: [{ descricao: 'Inválido', quantidade: -1, precoUnitarioCentavos: 2 }] })
      ).status,
    ).toBe(422);
  });
  it('aceita os segmentos e categorias confirmados da Tela Viva', async () => {
    const conta = await request(app.getHttpServer())
      .post('/v1/comercial/contas')
      .set(headers())
      .send({ nome: 'Estúdio QA', segmento: 'estudio_tatuagem' });
    expect(conta.status).toBe(201);
    expect(conta.body.registro.segmento).toBe('estudio_tatuagem');
    const produto = await request(app.getHttpServer())
      .post('/v1/comercial/produtos')
      .set(headers('gestor', GESTOR))
      .send({ nome: 'Cosmético QA', categoria: 'cosmetico' });
    expect(produto.status).toBe(201);
    expect(produto.body.registro.categoria).toBe('cosmetico');
  });
  it('não vaza contato de outra carteira pelo reenvio do idLocal', async () => {
    const idLocal = '16ebc622-39f2-44d7-858e-f9392b3f72c2';
    const criado = await request(app.getHttpServer())
      .post('/v1/contatos')
      .set(headers())
      .send({ idLocal, nome: 'Contato privado QA' });
    expect(criado.status).toBe(201);
    const repetido = await request(app.getHttpServer())
      .post('/v1/contatos')
      .set(headers())
      .send({ idLocal });
    expect(repetido.status).toBe(200);
    expect(repetido.body.dados._id).toBe(criado.body.dados._id);
    const outraCarteira = await request(app.getHttpServer())
      .post('/v1/contatos')
      .set(headers('vendedor', BIA))
      .send({ idLocal });
    expect(outraCarteira.status).toBe(403);
    expect(JSON.stringify(outraCarteira.body)).not.toContain('Contato privado QA');
  });
  it('fornece painel real e recusa parâmetros malformados', async () => {
    const conta = (
      await request(app.getHttpServer())
        .post('/v1/comercial/contas')
        .set(headers())
        .send({ nome: 'Hospital' })
    ).body.registro;
    const oportunidade = await request(app.getHttpServer())
      .post('/v1/comercial/oportunidades')
      .set(headers())
      .send({ contaId: conta._id, titulo: 'Material', etapa: 'proposta', valorCentavos: 50000 });
    expect(oportunidade.status).toBe(201);
    const painel = await request(app.getHttpServer()).get('/v1/comercial/painel').set(headers());
    expect(painel.status).toBe(200);
    expect(painel.body.indicadores.pipelineCentavos).toBe(50000);
    expect(painel.body.indicadores.visitasHoje).toBe(1);
    const vazio = await request(app.getHttpServer())
      .get('/v1/comercial/painel')
      .set(headers('vendedor', BIA));
    expect(vazio.body.indicadores.pipelineCentavos).toBe(0);
    expect(
      (await request(app.getHttpServer()).get('/v1/comercial/contas?limite=999').set(headers()))
        .status,
    ).toBe(422);
    expect(
      (await request(app.getHttpServer()).get('/v1/comercial/falso').set(headers())).status,
    ).toBe(404);
    expect(
      (await request(app.getHttpServer()).get('/v1/comercial/contas?q=%5B').set(headers())).status,
    ).toBe(200);
  });
});
