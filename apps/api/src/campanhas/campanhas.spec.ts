import { createHmac, randomBytes } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { getConnectionToken, MongooseModule } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Connection, Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { PapelGuard } from '../auth/papel.guard';
import { FiltroErros } from '../contatos/filtro-erros';
import { hmacDocumento } from '../seguranca/cifra';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { CampanhasModule } from './campanhas.module';
import { CampanhasService, calendario, modeloAprovado, podeAgendar } from './campanhas.service';
import {
  CADENCIA_PADRAO,
  MENSAGEM_INICIAL,
  type Campanha,
  type ControleCampanha,
} from './campanhas.tipos';

const ADMIN = '507f1f77bcf86cd799439121';
const VENDEDOR = '507f1f77bcf86cd799439555';
const head = (papel = 'admin', id = papel === 'vendedor' ? VENDEDOR : ADMIN) => ({
  'x-papel-teste': papel,
  'x-usuario-id': id,
  'x-autor-nome': 'Gestão QA',
});
const vars = [
  'NODE_ENV',
  'CIFRA_PEPPER',
  'CIFRA_CHAVE_BASE64',
  'CAMPANHAS_WHATSAPP_ATIVO',
  'WHATSAPP_ENVIO_ATIVO',
  'WHATSAPP_API_VERSAO',
  'WHATSAPP_WABA_ID',
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_APP_SECRET',
  'WHATSAPP_VERIFY_TOKEN',
];
const template = {
  id: '12345678',
  nome: 'tattoo_week',
  idioma: 'pt_BR',
  corpo: MENSAGEM_INICIAL,
  status: 'APPROVED',
  categoria: 'MARKETING',
};
const graphTemplate = () => ({
  id: template.id,
  name: template.nome,
  language: template.idioma,
  status: 'APPROVED',
  category: 'MARKETING',
  components: [{ type: 'BODY', text: template.corpo }],
});

describe('CP — campanhas em Mongo isolado e transporte simulado', () => {
  let app: INestApplication;
  let mongo: MongoMemoryServer;
  let db: Connection;
  let svc: CampanhasService;
  let transporte: jest.MockedFunction<typeof fetch>;
  let instante: Date;
  let seq: number;
  const anterior = Object.fromEntries(vars.map((v) => [v, process.env[v]]));
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.CIFRA_PEPPER = randomBytes(32).toString('hex');
    process.env.CIFRA_CHAVE_BASE64 = randomBytes(32).toString('base64');
    mongo = await MongoMemoryServer.create();
    const mod = await Test.createTestingModule({
      imports: [MongooseModule.forRoot(mongo.getUri()), CampanhasModule, WhatsAppModule],
      providers: [
        { provide: APP_GUARD, useClass: PapelGuard },
        { provide: APP_FILTER, useClass: FiltroErros },
      ],
    }).compile();
    app = mod.createNestApplication({ rawBody: true });
    await app.init();
    db = app.get(getConnectionToken());
    svc = app.get(CampanhasService);
  });
  beforeEach(async () => {
    Object.assign(process.env, {
      CAMPANHAS_WHATSAPP_ATIVO: 'true',
      WHATSAPP_ENVIO_ATIVO: 'false',
      WHATSAPP_API_VERSAO: 'v99.0',
      WHATSAPP_WABA_ID: '12345678901',
      WHATSAPP_PHONE_NUMBER_ID: '123456789012',
      WHATSAPP_ACCESS_TOKEN: 'token-ficticio-sem-acesso-meta',
      WHATSAPP_APP_SECRET: 'secret-ficticio-sem-acesso-meta',
      WHATSAPP_VERIFY_TOKEN: 'verify-ficticio-sem-acesso-meta',
    });
    for (const c of [
      'contatos',
      'whatsapp_campanhas',
      'whatsapp_campanhas_fila',
      'whatsapp_campanhas_controle',
      'whatsapp_recibos',
      'whatsapp_respostas',
      'whatsapp_bloqueios',
      'acessos_dados',
    ])
      await db.db!.collection(c).deleteMany({});
    await db.db!.collection('whatsapp_campanhas_controle').insertOne({
      _id: 'global' as never,
      reservaAte: new Date(0),
      proximaSaidaEm: new Date(0),
      dia: '',
      diario: 0,
      lote: 0,
    });
    instante = new Date('2026-11-23T13:00:00Z');
    svc.agora = () => instante;
    seq = 0;
    transporte = jest.fn<
      ReturnType<typeof fetch>,
      Parameters<typeof fetch>
    >() as jest.MockedFunction<typeof fetch>;
    transporte.mockImplementation(async (_url, init) =>
      init?.method === 'POST'
        ? new Response(JSON.stringify({ messages: [{ id: `wamid.qa-${++seq}` }] }), { status: 200 })
        : new Response(JSON.stringify({ data: [graphTemplate()] }), { status: 200 }),
    );
    svc.fetchImpl = transporte;
  });
  afterAll(async () => {
    if (app) await app.close();
    if (mongo) await mongo.stop();
    for (const [k, v] of Object.entries(anterior)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
  const api = () => request(app.getHttpServer());
  const posts = () => transporte.mock.calls.filter(([, init]) => init?.method === 'POST');
  async function lead(extra: Record<string, unknown> = {}, telefone = '+5511999990042') {
    const id = new Types.ObjectId();
    await db.db!.collection('contatos').insertOne({
      _id: id,
      nome: `Contato ${id.toString().slice(-4)}`,
      status: 'capturado',
      criadoEm: new Date('2026-11-10T23:00:00Z'),
      origem: { modo: 'qr_proprio' },
      tags: ['Tattoo Week'],
      telefones: [{ e164: telefone, principal: true }],
      lgpd: {
        contatoComercial: 'concedido',
        consentimentos: [
          { finalidade: 'contato_comercial', versaoTermo: 'qa', hashTexto: 'qa-hash' },
        ],
      },
      ...extra,
    });
    return id.toString();
  }
  async function criar(ids: string[], extra: Record<string, unknown> = {}) {
    const r = await api()
      .post('/v1/campanhas')
      .set(head())
      .send({ titulo: 'Tattoo Week QA', contatosIds: ids, template, ...extra });
    expect(r.status).toBe(201);
    return r.body.registro as Campanha;
  }
  async function preparar(c: Campanha) {
    const r = await api()
      .post(`/v1/campanhas/${c._id}/preparar`)
      .set(head())
      .send({ versao: c.versao });
    expect(r.status).toBe(201);
    return r.body.registro as Campanha;
  }
  async function iniciar(c: Campanha) {
    const r = await api()
      .post(`/v1/campanhas/${c._id}/iniciar`)
      .set(head())
      .send({ versao: c.versao, confirmar: true });
    expect(r.status).toBe(201);
    return r.body.registro as Campanha;
  }
  async function campanha(ids: string[], extra: Record<string, unknown> = {}) {
    return iniciar(await preparar(await criar(ids, extra)));
  }
  async function resultado(c: Campanha) {
    return (await api().get(`/v1/campanhas/${c._id}/resultados`).set(head())).body.registro;
  }
  it('nega anônimo/auditor e permite gestão; salva rascunho sem configuração', async () => {
    expect((await api().get('/v1/campanhas').set(head('auditor'))).status).toBe(403);
    expect((await api().get('/v1/campanhas')).status).toBe(403);
    delete process.env.WHATSAPP_WABA_ID;
    process.env.CAMPANHAS_WHATSAPP_ATIVO = 'false';
    const r = await api()
      .post('/v1/campanhas')
      .set(head('gestor'))
      .send({ criadoPor: 'forjado', auditoria: [], versao: 500 });
    expect(r.status).toBe(201);
    expect(r.body.registro).toMatchObject({
      estado: 'rascunho',
      versao: 1,
      criadoPor: ADMIN,
      contatosIds: [],
      template: null,
    });
    const cfg = await api().get('/v1/campanhas/configuracao').set(head());
    expect(cfg.body.registro).toMatchObject({ envioAtivo: false, configuracaoCompleta: false });
    expect(cfg.text).not.toContain('token-ficticio');
    expect(cfg.body.registro.faltantes).toContain('WHATSAPP_WABA_ID');
    await svc.executarCiclo();
    expect(transporte).not.toHaveBeenCalled();
  });
  it('protege versão, autoria/auditoria e valida público, intervalo e operadores', async () => {
    const c = await criar([]);
    const edit = await api()
      .patch(`/v1/campanhas/${c._id}`)
      .set(head())
      .send({ versao: c.versao, titulo: 'Revisada', auditoria: [] });
    expect(edit.status).toBe(200);
    expect(edit.body.registro.auditoria).toHaveLength(2);
    expect(JSON.stringify(edit.body.registro.auditoria)).not.toContain(ADMIN);
    expect(
      (
        await api()
          .patch(`/v1/campanhas/${c._id}`)
          .set(head())
          .send({ versao: 1, titulo: 'Desatualizada' })
      ).status,
    ).toBe(409);
    for (const body of [
      { contatosIds: [{ $ne: null }] },
      { contatosIds: Array(2001).fill(ADMIN) },
      { cadencia: { intervaloSegundos: 59 } },
      { cadencia: { inicioManha: '19:00', fimManha: '12:00' } },
    ])
      expect((await api().post('/v1/campanhas').set(head()).send(body)).status).toBe(422);
    expect((await api().get('/v1/campanhas/candidatos?q[$ne]=x').set(head())).status).toBe(422);
  });
  it('lista candidatos mascarados com filtros e audita leitura sem nome pesquisado', async () => {
    const id = await lead({ nome: 'Marina Tattoo' });
    await lead({ nome: 'Outra', origem: { modo: 'manual' } });
    const r = await api()
      .get(
        '/v1/campanhas/candidatos?q=Marina&origem=qr_proprio&tag=Tattoo%20Week&de=2026-11-10&ate=2026-11-10',
      )
      .set(head());
    expect(r.status).toBe(200);
    expect(r.body.registros).toHaveLength(1);
    expect(r.body.registros[0].id).toBe(id);
    expect(r.text).not.toContain('5511999990042');
    expect(r.body.registros[0].telefoneMascarado).toContain('0042');
    const audit = await db
      .db!.collection('acessos_dados')
      .findOne({ acao: 'campanhas_candidatos' });
    expect(audit?.quantidade).toBe(1);
    expect(JSON.stringify(audit)).not.toContain('Marina');
  });
  it('lista quem ficou de fora com motivo, contagem e pista do telefone, sem número inteiro', async () => {
    await lead({ nome: 'Elegível' });
    const semAceite = await lead({ nome: 'Sem Aceite', lgpd: { contatoComercial: 'pendente' } });
    const semFone = await lead({ nome: 'Fone Curto', telefones: [{ bruto: '9999-1234' }] });
    await lead({ nome: 'Descartado', status: 'descartado', lgpd: {} });
    const r = await api().get('/v1/campanhas/pendencias').set(head('gestor'));
    expect(r.status).toBe(200);
    expect(r.body.contagem).toEqual({ sem_autorizacao_documentada: 1, sem_telefone_valido: 1 });
    expect(r.body.elegiveis).toBe(1);
    expect(r.body.registros.map((x: { id: string }) => x.id).sort()).toEqual(
      [semAceite, semFone].sort(),
    );
    const curto = r.body.registros.find((x: { id: string }) => x.id === semFone);
    expect(curto.telefoneRegistrado).toBe('8 dígitos, final 1234');
    expect(r.text).not.toContain('5511999990042');
    expect(r.text).not.toContain('Descartado');
    const filtrado = await api()
      .get('/v1/campanhas/pendencias?motivo=sem_telefone_valido')
      .set(head('gestor'));
    expect(filtrado.body.registros).toHaveLength(1);
    expect(filtrado.body.total).toBe(1);
    const audit = await db
      .db!.collection('acessos_dados')
      .findOne({ acao: 'campanhas_pendencias' });
    expect(audit).toBeTruthy();
  });
  it('exclui autorização ausente, optout e status inválido e deduplica telefone na prévia/fila', async () => {
    const ids = [
      await lead(),
      await lead(),
      await lead({ lgpd: { contatoComercial: 'concedido', consentimentos: [] } }, '+5511999990043'),
      await lead({ status: 'descartado' }, '+5511999990044'),
      await lead({}, '+5511999990045'),
    ];
    await db
      .db!.collection('whatsapp_bloqueios')
      .insertOne({ telefoneHash: hmacDocumento('whatsapp:5511999990045'), em: instante });
    const c = await criar(ids);
    const p = await api()
      .post(`/v1/campanhas/${c._id}/previa`)
      .set(head())
      .send({ versao: c.versao });
    expect(p.body.registro).toMatchObject({
      selecionados: 5,
      elegiveis: 1,
      duplicados: 1,
      excluidos: 4,
    });
    expect(p.text).not.toContain('telefoneHash');
    expect(p.text).not.toContain('5511999990042');
    const preparado = await preparar(c);
    expect(preparado.estado).toBe('preparada');
    expect(await db.db!.collection('whatsapp_campanhas_fila').countDocuments()).toBe(1);
    expect(
      await db.db!.collection('acessos_dados').countDocuments({ acao: 'campanhas_previa' }),
    ).toBe(1);
  });
  it('não congela sem template verificado e recusa parâmetros/header/categoria/status/corpo incompatível', async () => {
    const id = await lead();
    let c = await criar([id], { template: null });
    expect(
      (await api().post(`/v1/campanhas/${c._id}/preparar`).set(head()).send({ versao: c.versao }))
        .status,
    ).toBe(422);
    expect((await api().get(`/v1/campanhas/${c._id}`).set(head())).body.registro.estado).toBe(
      'rascunho',
    );
    c = await criar([id], { mensagem: 'texto livre diferente' });
    expect(
      (await api().post(`/v1/campanhas/${c._id}/preparar`).set(head()).send({ versao: c.versao }))
        .status,
    ).toBe(422);
    for (const t of [
      { ...graphTemplate(), status: 'PAUSED' },
      { ...graphTemplate(), category: 'UTILITY' },
      { ...graphTemplate(), components: [{ type: 'BODY', text: 'Olá {{1}}' }] },
      {
        ...graphTemplate(),
        components: [
          { type: 'BODY', text: 'Olá' },
          { type: 'HEADER', format: 'TEXT', text: 'x' },
        ],
      },
    ])
      expect(modeloAprovado(t)).toBeNull();
    expect(modeloAprovado(graphTemplate())?.corpo).toBe(MENSAGEM_INICIAL);
  });
  it('prepara OFF sem enviar e exige flag e confirmação para iniciar/retomar', async () => {
    process.env.CAMPANHAS_WHATSAPP_ATIVO = 'false';
    const c = await preparar(await criar([await lead()]));
    expect(
      (
        await api()
          .post(`/v1/campanhas/${c._id}/iniciar`)
          .set(head())
          .send({ versao: c.versao, confirmar: true })
      ).status,
    ).toBe(422);
    await svc.executarCiclo();
    expect(posts()).toHaveLength(0);
    process.env.CAMPANHAS_WHATSAPP_ATIVO = 'true';
    expect(
      (await api().post(`/v1/campanhas/${c._id}/iniciar`).set(head()).send({ versao: c.versao }))
        .status,
    ).toBe(422);
  });
  it('aceite não é entrega; recibos compartilhados elevam sem regredir e leituras são auditadas', async () => {
    const c = await campanha([await lead()]);
    await svc.executarCiclo();
    expect(posts()).toHaveLength(1);
    expect((await resultado(c)).resumo).toEqual({ aceito: 1 });
    await db
      .db!.collection('whatsapp_recibos')
      .insertOne({ mensagemId: 'wamid.qa-1', entregue: true, atualizadoEm: instante });
    expect((await resultado(c)).resumo).toEqual({ entregue: 1 });
    await db
      .db!.collection('whatsapp_recibos')
      .updateOne({ mensagemId: 'wamid.qa-1' }, { $set: { lido: true, falhou: true } });
    expect((await resultado(c)).resumo).toEqual({ lido: 1 });
    expect(JSON.stringify(await resultado(c))).not.toContain('telefoneHash');
    expect(
      await db.db!.collection('acessos_dados').countDocuments({ acao: 'campanhas_resultados' }),
    ).toBeGreaterThan(0);
  });
  it.each(['revogacao', 'telefone', 'optout', 'resposta'])(
    'revalida %s antes de cada saída',
    async (cenario) => {
      const id = await lead();
      const c = await campanha([id]);
      if (cenario === 'revogacao')
        await db
          .db!.collection('contatos')
          .updateOne(
            { _id: new Types.ObjectId(id) },
            { $set: { 'lgpd.contatoComercial': 'revogado' } },
          );
      if (cenario === 'telefone')
        await db
          .db!.collection('contatos')
          .updateOne(
            { _id: new Types.ObjectId(id) },
            { $set: { telefones: [{ e164: '+5511999990000' }] } },
          );
      if (cenario === 'optout')
        await db
          .db!.collection('whatsapp_bloqueios')
          .insertOne({ telefoneHash: hmacDocumento('whatsapp:5511999990042') });
      if (cenario === 'resposta')
        await db
          .db!.collection('whatsapp_respostas')
          .insertOne({ telefoneHash: hmacDocumento('whatsapp:5511999990042'), em: instante });
      await svc.executarCiclo();
      expect(posts()).toHaveLength(0);
      expect((await resultado(c)).resumo).toEqual({ excluido: 1 });
    },
  );
  it('respostas anteriores à campanha não excluem e o webhook não guarda conversa', async () => {
    const c = await campanha([await lead()]);
    await db.db!.collection('whatsapp_respostas').insertOne({
      telefoneHash: hmacDocumento('whatsapp:5511999990042'),
      em: new Date(instante.getTime() - 1000),
    });
    await svc.executarCiclo();
    expect((await resultado(c)).resumo).toEqual({ aceito: 1 });
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              field: 'messages',
              value: {
                metadata: { phone_number_id: process.env.WHATSAPP_PHONE_NUMBER_ID },
                messages: [
                  {
                    from: '5511999990042',
                    id: 'wamid.resposta',
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    text: { body: 'conteudo privado nao armazenar' },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const raw = Buffer.from(JSON.stringify(payload));
    await app
      .get(WhatsAppService)
      .receberWebhook(
        raw,
        `sha256=${createHmac('sha256', process.env.WHATSAPP_APP_SECRET!).update(raw).digest('hex')}`,
      );
    const resposta = await db
      .db!.collection('whatsapp_respostas')
      .findOne({ _id: { $type: 'string' } });
    expect(resposta?.telefoneHash).toBe(hmacDocumento('whatsapp:5511999990042'));
    expect(JSON.stringify(resposta)).not.toContain('conteudo privado');
    expect(JSON.stringify(resposta)).not.toContain('5511999990042');
  });
  it('pausa, retoma e reinicia instância sem duplicar destinatários já aceitos', async () => {
    let c = await campanha([await lead(), await lead({}, '+5511999990043')]);
    await svc.executarCiclo();
    let r = await api()
      .post(`/v1/campanhas/${c._id}/pausar`)
      .set(head())
      .send({ versao: c.versao });
    expect(r.status).toBe(201);
    c = r.body.registro;
    instante = new Date(instante.getTime() + 90_000);
    await svc.executarCiclo();
    expect(posts()).toHaveLength(1);
    r = await api()
      .post(`/v1/campanhas/${c._id}/retomar`)
      .set(head())
      .send({ versao: c.versao, confirmar: true });
    expect(r.status).toBe(201);
    c = r.body.registro;
    const outra = new CampanhasService(db);
    outra.agora = () => instante;
    outra.fetchImpl = transporte;
    await outra.executarCiclo();
    expect(posts()).toHaveLength(2);
    instante = new Date(instante.getTime() + 90_000);
    await outra.executarCiclo();
    expect(posts()).toHaveLength(2);
    expect((await api().get(`/v1/campanhas/${c._id}`).set(head())).body.registro.estado).toBe(
      'concluida',
    );
  });
  it('respeita intervalo global entre campanhas e evita POST concorrente entre instâncias', async () => {
    await campanha([await lead()]);
    await campanha([await lead({}, '+5511999990043')]);
    const outra = new CampanhasService(db);
    outra.agora = () => instante;
    outra.fetchImpl = transporte;
    await Promise.all([svc.executarCiclo(), outra.executarCiclo()]);
    expect(posts()).toHaveLength(1);
    await outra.executarCiclo();
    expect(posts()).toHaveLength(1);
    instante = new Date(instante.getTime() + 90_000);
    await Promise.all([svc.executarCiclo(), outra.executarCiclo()]);
    expect(posts()).toHaveLength(2);
  });
  it('respeita lotes/pausas/teto diário e retorna no próximo dia útil', async () => {
    await campanha(
      [await lead(), await lead({}, '+5511999990043'), await lead({}, '+5511999990044')],
      {
        cadencia: { intervaloSegundos: 60, loteTamanho: 1, pausaLoteSegundos: 600, tetoDiario: 2 },
      },
    );
    await svc.executarCiclo();
    expect(posts()).toHaveLength(1);
    instante = new Date(instante.getTime() + 60_000);
    await svc.executarCiclo();
    expect(posts()).toHaveLength(1);
    instante = new Date(instante.getTime() + 540_000);
    await svc.executarCiclo();
    expect(posts()).toHaveLength(2);
    instante = new Date(instante.getTime() + 600_000);
    await svc.executarCiclo();
    expect(posts()).toHaveLength(2);
    instante = new Date('2026-11-24T13:00:00Z');
    await svc.executarCiclo();
    expect(posts()).toHaveLength(3);
  });
  it('revalida janela depois de consultar templates e pausa template suspenso', async () => {
    const c = await campanha([await lead()]);
    transporte.mockImplementation(async (_url, init) => {
      if (init?.method === 'POST')
        return new Response(JSON.stringify({ messages: [{ id: 'wamid.nunca' }] }));
      instante = new Date('2026-11-23T15:01:00Z'); //12h01SP depois de consulta lenta.
      return new Response(JSON.stringify({ data: [graphTemplate()] }));
    });
    await svc.executarCiclo();
    expect(posts()).toHaveLength(0);
    instante = new Date('2026-11-23T17:01:00Z');
    transporte.mockResolvedValue(
      new Response(JSON.stringify({ data: [{ ...graphTemplate(), status: 'PAUSED' }] })),
    );
    await svc.executarCiclo();
    expect(posts()).toHaveLength(0);
    expect((await api().get(`/v1/campanhas/${c._id}`).set(head())).body.registro.estado).toBe(
      'pausada',
    );
  });
  it.each([500, 408, 'rede'])('resultado ambíguo %s fica incerto, sem retry', async (codigo) => {
    const c = await campanha([await lead()]);
    transporte.mockImplementation(async (_url, init) => {
      if (init?.method !== 'POST') return new Response(JSON.stringify({ data: [graphTemplate()] }));
      if (codigo === 'rede') throw new Error('network');
      return new Response('{}', { status: codigo as number });
    });
    await svc.executarCiclo();
    instante = new Date(instante.getTime() + 300_000);
    await svc.executarCiclo();
    expect(posts()).toHaveLength(1);
    expect((await resultado(c)).resumo).toEqual({ incerto: 1 });
  });
  it('429 respeita Retry-After global e reserva abandonada nunca volta a pendente', async () => {
    const c = await campanha([await lead()]);
    transporte.mockImplementation(async (_url, init) =>
      init?.method === 'POST'
        ? new Response('{}', { status: 429, headers: { 'retry-after': '3600' } })
        : new Response(JSON.stringify({ data: [graphTemplate()] })),
    );
    await svc.executarCiclo();
    instante = new Date(instante.getTime() + 300_000);
    await svc.executarCiclo();
    expect(posts()).toHaveLength(1);
    await db
      .db!.collection('whatsapp_campanhas_fila')
      .updateOne(
        { campanhaId: new Types.ObjectId(c._id) },
        { $set: { estado: 'processando', reservaId: 'processo-morto', reservaAte: new Date(0) } },
      );
    await svc.executarCiclo();
    expect((await resultado(c)).resumo).toEqual({ incerto: 1 });
    expect(posts()).toHaveLength(1);
    const fila = await db
      .db!.collection('whatsapp_campanhas_fila')
      .findOne({ campanhaId: new Types.ObjectId(c._id) });
    expect(fila?.eventos.at(-1)).toMatchObject({
      estado: 'incerto',
      autor: 'worker:campanhas',
      tentativa: 1,
      codigo: 'reserva_perdida_verificar_meta',
    });
  });
  it('mantém trilha append-only de429, retry, aceite e recibo sem dados pessoais', async () => {
    const c = await campanha([await lead()]);
    let tentativa = 0;
    transporte.mockImplementation(async (_url, init) => {
      if (init?.method !== 'POST') return new Response(JSON.stringify({ data: [graphTemplate()] }));
      tentativa++;
      return tentativa === 1
        ? new Response('{}', { status: 429, headers: { 'retry-after': '120' } })
        : new Response(JSON.stringify({ messages: [{ id: 'wamid.retry' }] }));
    });
    await svc.executarCiclo();
    instante = new Date(instante.getTime() + 120_000);
    await svc.executarCiclo();
    await db
      .db!.collection('whatsapp_recibos')
      .insertOne({ mensagemId: 'wamid.retry', entregue: true, atualizadoEm: instante });
    await resultado(c);
    const fila = await db
      .db!.collection('whatsapp_campanhas_fila')
      .findOne({ campanhaId: new Types.ObjectId(c._id) });
    expect(fila?.eventos.map((e: { estado: string }) => e.estado)).toEqual([
      'pendente',
      'processando',
      'pendente',
      'processando',
      'aceito',
      'entregue',
    ]);
    expect(fila?.eventos.map((e: { tentativa: number }) => e.tentativa)).toEqual([
      0, 1, 1, 2, 2, 2,
    ]);
    expect(fila?.eventos.every((e: { autor: string }) => e.autor === 'worker:campanhas')).toBe(
      true,
    );
    expect(JSON.stringify(fila?.eventos)).not.toContain('5511999990042');
    expect(JSON.stringify(fila?.eventos)).not.toContain('token');
    expect(JSON.stringify(fila?.eventos)).not.toContain(MENSAGEM_INICIAL);
  });
  it('falha de autenticação pausa a campanha sem continuar para o próximo contato', async () => {
    const c = await campanha([await lead(), await lead({}, '+5511999990043')]);
    transporte.mockImplementation(async (_url, init) =>
      init?.method === 'POST'
        ? new Response('{}', { status: 401 })
        : new Response(JSON.stringify({ data: [graphTemplate()] })),
    );
    await svc.executarCiclo();
    instante = new Date(instante.getTime() + 90_000);
    await svc.executarCiclo();
    expect(posts()).toHaveLength(1);
    expect((await api().get(`/v1/campanhas/${c._id}`).set(head())).body.registro.estado).toBe(
      'pausada',
    );
    expect((await resultado(c)).resumo).toEqual({ falha: 1, pendente: 1 });
  });
  it('cancelar preserva fila e rejeita retomada, sem apagar histórico', async () => {
    const c = await campanha([await lead()]);
    const r = await api()
      .post(`/v1/campanhas/${c._id}/cancelar`)
      .set(head())
      .send({ versao: c.versao });
    expect(r.status).toBe(201);
    expect(r.body.registro.auditoria.at(-1).acao).toBe('cancelar');
    expect((await resultado(c)).resumo).toEqual({ cancelado: 1 });
    expect(
      (
        await api()
          .post(`/v1/campanhas/${c._id}/retomar`)
          .set(head())
          .send({ versao: r.body.registro.versao, confirmar: true })
      ).status,
    ).toBe(409);
    await svc.executarCiclo();
    expect(posts()).toHaveLength(0);
  });
  it('calendário SãoPaulo e limites inclusivos/exclusivos são determinísticos', () => {
    const controle: ControleCampanha = {
      _id: 'global',
      reservaAte: new Date(0),
      proximaSaidaEm: new Date(0),
      dia: '',
      diario: 0,
      lote: 0,
    };
    expect(calendario(new Date('2026-11-23T02:00:00Z')).dia).toBe('2026-11-22');
    for (const hora of [
      '2026-11-22T13:00:00Z',
      '2026-11-23T11:59:00Z',
      '2026-11-23T15:00:00Z',
      '2026-11-23T20:00:00Z',
    ])
      expect(podeAgendar(new Date(hora), CADENCIA_PADRAO, controle)).toBe(false);
    expect(podeAgendar(new Date('2026-11-23T12:00:00Z'), CADENCIA_PADRAO, controle)).toBe(true);
    expect(podeAgendar(new Date('2026-11-23T17:00:00Z'), CADENCIA_PADRAO, controle)).toBe(true);
  });

  describe('modo manual (WhatsApp Web)', () => {
    async function manualPreparada(ids: string[]) {
      const c = await criar(ids, { modo: 'manual', template: null });
      expect(c.modo).toBe('manual');
      return preparar(c);
    }
    async function fila(c: Campanha) {
      return db
        .db!.collection('whatsapp_campanhas_fila')
        .find({ campanhaId: new Types.ObjectId(String(c._id)) })
        .sort({ _id: 1 })
        .toArray();
    }
    const abrir = (c: Campanha, destino: unknown, papel = 'gestor') =>
      api()
        .post(`/v1/campanhas/${c._id}/destinatarios/${String(destino)}/whatsapp-manual`)
        .set(head(papel));

    it('prepara sem template/Meta, nunca envia sozinho e recusa iniciar', async () => {
      process.env.CAMPANHAS_WHATSAPP_ATIVO = 'false';
      delete process.env.WHATSAPP_WABA_ID;
      delete process.env.WHATSAPP_ACCESS_TOKEN;
      const c = await manualPreparada([await lead()]);
      expect(c.estado).toBe('preparada');
      const r = await api()
        .post(`/v1/campanhas/${c._id}/iniciar`)
        .set(head())
        .send({ versao: c.versao, confirmar: true });
      expect(r.status).toBe(422);
      // Mesmo que alguém force o estado, o robô ignora campanha manual.
      process.env.CAMPANHAS_WHATSAPP_ATIVO = 'true';
      process.env.WHATSAPP_WABA_ID = '12345678901';
      process.env.WHATSAPP_ACCESS_TOKEN = 'token-ficticio-sem-acesso-meta';
      await db
        .db!.collection('whatsapp_campanhas')
        .updateOne(
          { _id: new Types.ObjectId(String(c._id)) },
          { $set: { estado: 'em_andamento' } },
        );
      await svc.executarCiclo();
      expect(transporte).not.toHaveBeenCalled();
      expect((await fila(c))[0].estado).toBe('pendente');
    });

    it('abre conversa com telefone e texto, respeita intervalo e permite reabrir', async () => {
      const c = await manualPreparada([
        await lead({}, '+5511999990001'),
        await lead({}, '+5511999990002'),
      ]);
      const [a, b] = await fila(c);
      const r1 = await abrir(c, a._id);
      expect(r1.status).toBe(201);
      expect(r1.body.registro).toMatchObject({
        telefone: '5511999990001',
        texto: MENSAGEM_INICIAL,
        primeiraAbertura: true,
      });
      const cedo = await abrir(c, b._id);
      expect(cedo.status).toBe(429);
      expect(cedo.body.erros?.[0]?.mensagem ?? cedo.text).toMatch(/Aguarde \d+s/);
      // Reabrir o mesmo contato não espera o intervalo.
      expect((await abrir(c, a._id)).body.registro.primeiraAbertura).toBe(false);
      instante = new Date(instante.getTime() + CADENCIA_PADRAO.intervaloSegundos * 1000);
      expect((await abrir(c, b._id)).status).toBe(201);
      const [fa, fb] = await fila(c);
      expect([fa.estado, fb.estado]).toEqual(['aberto_manual', 'aberto_manual']);
      expect(fa.eventos.map((e: { codigo: string }) => e.codigo)).toEqual([
        'preparado',
        'whatsapp_web_aberto',
        'whatsapp_web_reaberto',
      ]);
      expect(JSON.stringify(fa.eventos)).not.toContain(ADMIN);
      const res = await resultado(c);
      expect(res.modo).toBe('manual');
      expect(res.resumo).toEqual({ aberto_manual: 2 });
      expect(res.registros[0].nome).toMatch(/^Contato /);
      expect(JSON.stringify(res.registros)).not.toContain('999990001');
      expect(
        await db.db!.collection('acessos_dados').countDocuments({ acao: 'campanhas_envio_manual' }),
      ).toBe(3);
      expect(transporte).not.toHaveBeenCalled();
    });

    it('representante vê todas as campanhas, mas só altera as próprias, da própria carteira e manuais', async () => {
      const dono = { origem: { modo: 'manual', vendedorAtribuido: new Types.ObjectId(VENDEDOR) } };
      const meu = await lead(dono, '+5511999990101');
      const alheio = await lead({}, '+5511999990102');
      const daGestao = await criar([alheio]);
      const vend = head('vendedor');
      const lista = await api().get('/v1/campanhas').set(vend);
      expect(lista.status).toBe(200);
      expect(lista.body.registros.map((x: Campanha) => String(x._id))).toContain(
        String(daGestao._id),
      );
      expect((await api().get(`/v1/campanhas/${daGestao._id}`).set(vend)).status).toBe(200);
      expect((await api().get(`/v1/campanhas/${daGestao._id}/resultados`).set(vend)).status).toBe(
        200,
      );
      const alheia = await api()
        .patch(`/v1/campanhas/${daGestao._id}`)
        .set(vend)
        .send({ versao: daGestao.versao, titulo: 'Tomada' });
      expect(alheia.status).toBe(403);
      expect(alheia.text).toContain('CAMPANHA_DE_OUTRA_PESSOA');
      const candidatos = await api().get('/v1/campanhas/candidatos').set(vend);
      expect(candidatos.body.registros.map((x: { id: string }) => x.id)).toEqual([meu]);
      const pend = await api().get('/v1/campanhas/pendencias').set(vend);
      expect(pend.status).toBe(200);
      expect(
        (await api().post('/v1/campanhas').set(vend).send({ titulo: 'API', modo: 'api' })).status,
      ).toBe(403);
      const criada = await api()
        .post('/v1/campanhas')
        .set(vend)
        .send({ titulo: 'Minha carteira', contatosIds: [meu, alheio] });
      expect(criada.status).toBe(201);
      const c = criada.body.registro as Campanha;
      expect(c.modo).toBe('manual');
      const previa = await api()
        .post(`/v1/campanhas/${c._id}/previa`)
        .set(vend)
        .send({ versao: c.versao });
      const motivos = Object.fromEntries(
        previa.body.registro.destinatarios.map((d: { contatoId: string; motivo: string }) => [
          d.contatoId,
          d.motivo,
        ]),
      );
      expect(motivos).toEqual({ [meu]: '', [alheio]: 'fora_da_carteira' });
      expect(
        (
          await api()
            .patch(`/v1/campanhas/${c._id}`)
            .set(vend)
            .send({ versao: c.versao, modo: 'api' })
        ).status,
      ).toBe(403);
      const preparada = await api()
        .post(`/v1/campanhas/${c._id}/preparar`)
        .set(vend)
        .send({ versao: c.versao, confirmarPublico: true });
      expect(preparada.status).toBeLessThan(300);
      const [d] = await fila(preparada.body.registro as Campanha);
      expect(String(d.contatoId)).toBe(meu);
      const aberto = await abrir(preparada.body.registro as Campanha, d._id, 'vendedor');
      expect(aberto.status).toBe(201);
      expect(transporte).not.toHaveBeenCalled();
    });

    it('mostra quem ficou de fora depois de preparar e deixa incluir telefone repetido', async () => {
      const primeira = await lead({ nome: 'Primeira Estúdio' }, '+5511999990301');
      const repetida = await lead({ nome: 'Segunda Estúdio' }, '+5511999990301');
      const semAceite = await lead(
        { nome: 'Sem Aceite', lgpd: { contatoComercial: 'pendente' } },
        '+5511999990302',
      );
      const c = await manualPreparada([primeira, repetida, semAceite]);
      expect(await fila(c)).toHaveLength(1);
      const r = await resultado(c);
      const fora = Object.fromEntries(
        r.foraDaCampanha.map((x: { contatoId: string }) => [x.contatoId, x]),
      );
      expect(fora[repetida]).toMatchObject({
        nome: 'Segunda Estúdio',
        motivo: 'telefone_duplicado',
        mesmoNumeroDe: 'Primeira Estúdio',
        podeIncluir: true,
      });
      expect(fora[semAceite]).toMatchObject({
        motivo: 'sem_autorizacao_documentada',
        podeIncluir: false,
      });
      expect(JSON.stringify(r.foraDaCampanha)).not.toContain('999990301');
      const incluir = (contatoId: string, versao: number, papel = 'gestor') =>
        api()
          .post(`/v1/campanhas/${c._id}/destinatarios/incluir`)
          .set(head(papel))
          .send({ versao, contatoId });
      expect((await incluir(semAceite, c.versao)).status).toBe(409);
      expect((await incluir(repetida, c.versao, 'vendedor')).status).toBe(403);
      const ok = await incluir(repetida, c.versao);
      expect(ok.status).toBe(201);
      expect(ok.body.registro.repetidosLiberados).toEqual([repetida]);
      const filaDepois = await fila(c);
      expect(filaDepois).toHaveLength(2);
      expect(filaDepois[1]).toMatchObject({ estado: 'pendente' });
      expect(filaDepois[1].eventos[0].codigo).toBe('incluido_pelo_responsavel');
      expect((await incluir(repetida, ok.body.registro.versao)).status).toBe(409);
      const depois = await resultado(c);
      expect(depois.foraDaCampanha.map((x: { contatoId: string }) => x.contatoId)).toEqual([
        semAceite,
      ]);
      // Na prévia do rascunho, o repetido liberado deixa de ser excluído.
      const rascunho = await criar([primeira, repetida], { modo: 'manual', template: null });
      const liberado = await api()
        .post(`/v1/campanhas/${rascunho._id}/destinatarios/incluir`)
        .set(head())
        .send({ versao: rascunho.versao, contatoId: repetida });
      expect(liberado.status).toBe(201);
      const previa = await api()
        .post(`/v1/campanhas/${rascunho._id}/previa`)
        .set(head())
        .send({ versao: liberado.body.registro.versao });
      expect(previa.body.registro).toMatchObject({ elegiveis: 2, duplicados: 0 });
      const preparada = await preparar(liberado.body.registro as Campanha);
      expect(await fila(preparada)).toHaveLength(2);
      expect(transporte).not.toHaveBeenCalled();
    });

    it('revalida autorização antes de abrir e respeita papel e modo', async () => {
      const id = await lead();
      const c = await manualPreparada([id]);
      const [d] = await fila(c);
      expect((await abrir(c, d._id, 'vendedor')).status).toBe(403);
      await db
        .db!.collection('contatos')
        .updateOne(
          { _id: new Types.ObjectId(id) },
          { $set: { 'lgpd.contatoComercial': 'revogado', 'lgpd.revogadoEm': instante } },
        );
      const r = await abrir(c, d._id);
      expect(r.status).toBe(409);
      expect(r.text).not.toContain('999990042');
      expect((await fila(c))[0]).toMatchObject({ estado: 'excluido' });
      const api_ = await preparar(await criar([await lead({}, '+5511999990077')]));
      const [x] = await fila(api_);
      expect((await abrir(api_, x._id)).status).toBe(422);
      expect((await abrir(c, 'nao-e-id')).status).toBe(404);
    });
  });
});
