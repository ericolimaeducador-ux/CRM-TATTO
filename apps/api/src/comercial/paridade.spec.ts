import { randomBytes, randomUUID } from 'node:crypto';
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

const ANA = '507f1f77bcf86cd799439061';
const AUDITOR = '507f1f77bcf86cd799439062';
function headers(papel = 'vendedor', id = ANA) {
  return { 'x-papel-teste': papel, 'x-usuario-id': id, 'x-autor-nome': 'QA de paridade' };
}

describe('TV-15 — integridade e privacidade da paridade comercial', () => {
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
    await registros.init();
    await registros.db.collection('usuarios').insertOne({
      _id: new Types.ObjectId(ANA),
      login: 'qa-paridade',
      nome: 'QA de paridade',
      papel: 'vendedor',
      ativo: true,
      senhaHash: 'fixture-sem-login',
      criadoEm: new Date(),
    });
  });
  beforeEach(async () => {
    await registros.deleteMany({});
  });
  afterAll(async () => {
    if (app) await app.close();
    if (mongo) await mongo.stop();
    process.env.NODE_ENV = ambienteAnterior;
  });

  async function treinamento() {
    const inicio = new Date(Date.now() + 86_400_000).toISOString();
    const fim = new Date(Date.now() + 90_000_000).toISOString();
    const criado = await request(app.getHttpServer())
      .post('/v1/comercial/treinamentos')
      .set(headers())
      .send({ titulo: 'Evento QA isolado', dataInicio: inicio, dataFim: fim });
    expect(criado.status).toBe(201);
    return criado.body.registro as {
      _id: string;
      versao: number;
      dataInicio: string;
      dataFim: string;
    };
  }

  it('não duplica o mesmo e-mail no evento quando a inscrição vem da equipe e do QR', async () => {
    const evento = await treinamento();
    const inscrito = await request(app.getHttpServer())
      .post('/v1/comercial/participantes')
      .set(headers())
      .send({ treinamentoId: evento._id, nome: 'Pessoa QA isolada', email: 'Pessoa@Exemplo.test' });
    expect(inscrito.status).toBe(201);
    const qr = await request(app.getHttpServer())
      .post(`/v1/comercial/treinamentos/${evento._id}/qr`)
      .set(headers());
    expect(qr.status).toBe(201);
    const publica = await request(app.getHttpServer())
      .post(`/v1/comercial/publico/treinamentos/${qr.body.tokenInscricao}`)
      .send({ nome: 'Pessoa QA isolada', email: 'pessoa@exemplo.test' });
    expect(publica.status).toBe(201);
    expect(publica.body).toMatchObject({ inscricao: 'registrada', repetida: true });
    expect(
      await registros.countDocuments({ tipo: 'participantes', 'campos.treinamentoId': evento._id }),
    ).toBe(1);
  });

  it('nega ao auditor a lista e a consulta individual de participantes com dados pessoais', async () => {
    const evento = await treinamento();
    const inscrito = await request(app.getHttpServer())
      .post('/v1/comercial/participantes')
      .set(headers())
      .send({
        treinamentoId: evento._id,
        nome: 'Pessoa confidencial QA',
        email: 'privado@exemplo.test',
      });
    expect(inscrito.status).toBe(201);
    const lista = await request(app.getHttpServer())
      .get(`/v1/comercial/participantes?treinamentoId=${evento._id}`)
      .set(headers('auditor', AUDITOR));
    const individual = await request(app.getHttpServer())
      .get(`/v1/comercial/participantes/${inscrito.body.registro._id}`)
      .set(headers('auditor', AUDITOR));
    expect(lista.status).toBe(403);
    expect(individual.status).toBe(403);
    expect(JSON.stringify(lista.body)).not.toContain('privado@exemplo.test');
    expect(JSON.stringify(individual.body)).not.toContain('privado@exemplo.test');
  });

  it('valida a janela completa do treinamento mesmo quando PATCH altera somente o fim', async () => {
    const evento = await treinamento();
    const anteriorAoInicio = new Date(Date.parse(evento.dataInicio) - 60_000).toISOString();
    const alteracao = await request(app.getHttpServer())
      .patch(`/v1/comercial/treinamentos/${evento._id}`)
      .set(headers())
      .send({ versao: evento.versao, dataFim: anteriorAoInicio });
    expect(alteracao.status).toBe(422);
    const confirmado = await request(app.getHttpServer())
      .get(`/v1/comercial/treinamentos/${evento._id}`)
      .set(headers());
    expect(confirmado.body.registro.dataFim).toBe(evento.dataFim);
  });

  it('negocia preço com decisão da gestão, motivo e encerramento auditados', async () => {
    const conta = await request(app.getHttpServer())
      .post('/v1/comercial/contas')
      .set(headers())
      .send({ nome: 'Conta de preço QA' });
    const produto = await request(app.getHttpServer())
      .post('/v1/comercial/produtos')
      .set(headers('gestor'))
      .send({ nome: 'Produto de preço QA', precoCentavos: 2500 });
    expect(conta.status).toBe(201);
    expect(produto.status).toBe(201);
    const pedido = await request(app.getHttpServer())
      .post('/v1/comercial/precosCliente')
      .set(headers())
      .send({
        contaId: conta.body.registro._id,
        produtoId: produto.body.registro._id,
        precoCentavos: 1990,
        status: 'aprovado',
      });
    expect(pedido.status).toBe(201);
    expect(pedido.body.registro.status).toBe('solicitado');
    const id = pedido.body.registro._id;
    const atalho = await request(app.getHttpServer())
      .patch(`/v1/comercial/precosCliente/${id}`)
      .set(headers())
      .send({ versao: 1, status: 'aprovado' });
    expect(atalho.status).toBe(422);
    const vendedor = await request(app.getHttpServer())
      .post(`/v1/comercial/precosCliente/${id}/aprovar`)
      .set(headers())
      .send({ versao: 1 });
    expect(vendedor.status).toBe(403);
    const semMotivo = await request(app.getHttpServer())
      .post(`/v1/comercial/precosCliente/${id}/reprovar`)
      .set(headers('gestor'))
      .send({ versao: 1 });
    expect(semMotivo.status).toBe(422);
    const aprovado = await request(app.getHttpServer())
      .post(`/v1/comercial/precosCliente/${id}/aprovar`)
      .set(headers('gestor'))
      .send({ versao: 1, motivo: 'Condição comercial aprovada para QA' });
    expect(aprovado.status).toBe(201);
    expect(aprovado.body.registro).toMatchObject({ status: 'aprovado', versao: 2 });
    const semSobrescrita = await request(app.getHttpServer())
      .patch(`/v1/comercial/precosCliente/${id}`)
      .set(headers())
      .send({ versao: 2, precoCentavos: 1 });
    expect(semSobrescrita.status).toBe(422);
    const encerrado = await request(app.getHttpServer())
      .post(`/v1/comercial/precosCliente/${id}/encerrar`)
      .set(headers())
      .send({ versao: 2, resultado: 'ganho' });
    expect(encerrado.status).toBe(201);
    const trilha = await request(app.getHttpServer())
      .get(`/v1/comercial/precosCliente/${id}/auditoria`)
      .set(headers());
    expect(trilha.body.eventos.map((evento: { acao: string }) => evento.acao)).toEqual([
      'criar',
      'aprovar',
      'encerrar_ganho',
    ]);
  });

  it('registra a realização da tarefa com autor e relógio do servidor', async () => {
    const criado = await request(app.getHttpServer())
      .post('/v1/comercial/atividades')
      .set(headers())
      .send({
        titulo: 'Tarefa QA',
        tipo: 'tarefa',
        responsavelId: ANA,
        colaboradoresIds: [ANA, ANA],
      });
    expect(criado.status).toBe(201);
    expect(criado.body.registro.colaboradoresIds).toEqual([ANA]);
    const realizado = await request(app.getHttpServer())
      .patch(`/v1/comercial/atividades/${criado.body.registro._id}`)
      .set(headers())
      .send({
        versao: 1,
        status: 'concluida',
        realizacao: 'Apresentação realizada',
        realizadoPor: AUDITOR,
        realizadoEm: '2000-01-01T00:00:00Z',
      });
    expect(realizado.status).toBe(200);
    expect(realizado.body.registro).toMatchObject({
      realizadoPor: ANA,
      realizacao: 'Apresentação realizada',
      status: 'concluida',
    });
    expect(Date.parse(realizado.body.registro.realizadoEm)).toBeGreaterThan(Date.now() - 60_000);
  });

  it('proposta registra preparo de e-mail e bloqueia contato inativo sem afirmar envio', async () => {
    const contatoId = randomUUID();
    const conta = await request(app.getHttpServer())
      .post('/v1/comercial/contas')
      .set(headers())
      .send({
        nome: 'Conta de proposta QA',
        pessoas: [
          {
            id: contatoId,
            nome: 'Contato QA',
            email: 'contato@exemplo.test',
            principal: true,
            ativo: true,
          },
        ],
      });
    expect(conta.status).toBe(201);
    const proposta = await request(app.getHttpServer())
      .post('/v1/comercial/propostas')
      .set(headers())
      .send({ titulo: 'Proposta de contato QA', contaId: conta.body.registro._id, contatoId });
    expect(proposta.status).toBe(201);
    const preparo = await request(app.getHttpServer())
      .post(`/v1/comercial/propostas/${proposta.body.registro._id}/rascunho-email`)
      .set(headers())
      .send({ versao: 1 });
    expect(preparo.status).toBe(201);
    expect(preparo.body.registro).toMatchObject({ rascunhoEmailContatoId: contatoId, versao: 2 });
    const trilha = await request(app.getHttpServer())
      .get(`/v1/comercial/propostas/${proposta.body.registro._id}/auditoria`)
      .set(headers());
    expect(trilha.body.eventos.at(-1).acao).toBe('rascunho_email_solicitado');
    expect(JSON.stringify(trilha.body)).not.toContain('contato@exemplo.test');
    await request(app.getHttpServer())
      .patch(`/v1/comercial/contas/${conta.body.registro._id}`)
      .set(headers())
      .send({
        versao: 1,
        pessoas: [
          { id: contatoId, nome: 'Contato QA', email: 'contato@exemplo.test', ativo: false },
        ],
      })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/v1/comercial/propostas/${proposta.body.registro._id}/rascunho-email`)
      .set(headers())
      .send({ versao: 2 })
      .expect(422);
  });

  it('QR expõe só o evento, impede presença pelo visitante e exige TOTP na exportação', async () => {
    const evento = await treinamento();
    const qr = await request(app.getHttpServer())
      .post(`/v1/comercial/treinamentos/${evento._id}/qr`)
      .set(headers());
    const token = qr.body.tokenInscricao;
    const publico = await request(app.getHttpServer()).get(
      `/v1/comercial/publico/treinamentos/${token}`,
    );
    expect(publico.status).toBe(200);
    expect(Object.keys(publico.body)).toEqual(['treinamento']);
    expect(publico.body.treinamento).not.toHaveProperty('donoId');
    expect(publico.body.treinamento).not.toHaveProperty('tokenInscricaoHash');
    await request(app.getHttpServer())
      .post(`/v1/comercial/publico/treinamentos/${token}`)
      .send({
        nome: 'Participante QA',
        email: 'participante@exemplo.test',
        presente: true,
        confirmado: true,
        status: 'presente',
      })
      .expect(201);
    const lista = await request(app.getHttpServer())
      .get(`/v1/comercial/participantes?treinamentoId=${evento._id}`)
      .set(headers());
    expect(lista.body.registros).toHaveLength(1);
    const participante = lista.body.registros[0];
    expect(participante).toMatchObject({ status: 'inscrito', confirmado: false, presente: false });
    await request(app.getHttpServer())
      .patch(`/v1/comercial/participantes/${participante._id}`)
      .set(headers())
      .send({ versao: 1, presente: true })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/v1/comercial/participantes/${participante._id}`)
      .set(headers('gestor'))
      .send({ versao: 1, presente: true, confirmado: true, status: 'presente' })
      .expect(200);
    await request(app.getHttpServer())
      .get(`/v1/comercial/treinamentos/${evento._id}/participantes/exportar?formato=csv`)
      .set(headers('gestor'))
      .expect(403);
    const exportacao = await request(app.getHttpServer())
      .get(`/v1/comercial/treinamentos/${evento._id}/participantes/exportar?formato=csv`)
      .set({ ...headers('gestor'), 'x-step-up-teste': '1' });
    expect(exportacao.status).toBe(200);
    expect(exportacao.text).toContain('Participante QA');
    const auditoria = await registros.db
      .collection('auditoria_exportacao')
      .findOne({ 'filtros.treinamentoId': evento._id });
    expect(auditoria).toMatchObject({ quantidade: 1, formato: 'csv', papel: 'gestor' });
    const alteracao = await request(app.getHttpServer())
      .get(`/v1/comercial/treinamentos/${evento._id}`)
      .set(headers());
    await request(app.getHttpServer())
      .patch(`/v1/comercial/treinamentos/${evento._id}`)
      .set(headers())
      .send({ versao: alteracao.body.registro.versao, status: 'cancelado' })
      .expect(200);
    await request(app.getHttpServer())
      .get(`/v1/comercial/publico/treinamentos/${token}`)
      .expect(410);
  });
});
