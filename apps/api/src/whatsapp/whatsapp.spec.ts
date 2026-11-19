import { createHmac, randomBytes } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { getConnectionToken, getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Connection, Types, type Model } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { PapelGuard } from '../auth/papel.guard';
import { WhatsAppModule } from './whatsapp.module';
import { WhatsAppService } from './whatsapp.service';
import type {
  BloqueioWhatsApp,
  ControleWhatsApp,
  ReciboWhatsApp,
  TrabalhoWhatsApp,
} from './whatsapp.schema';

const SEGREDO_APP = 'segredo-qa-local-sem-conta-meta';
const VERIFY = 'verificacao-qa-local-sem-conta';
const PHONE_ID = '123456789012345';
const TELEFONE = '+5511999990042';
const ADMIN = '507f1f77bcf86cd799439121';
const VARIAVEIS = [
  'NODE_ENV',
  'CIFRA_PEPPER',
  'CIFRA_CHAVE_BASE64',
  'WHATSAPP_ENVIO_ATIVO',
  'WHATSAPP_API_VERSAO',
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_TEMPLATE_BOAS_VINDAS',
  'WHATSAPP_TEMPLATE_IDIOMA',
  'WHATSAPP_APP_SECRET',
  'WHATSAPP_VERIFY_TOKEN',
];
const concessao = () => ({
  contatoComercial: 'concedido',
  consentimentos: [
    { finalidade: 'contato_comercial', versaoTermo: 'termo-qa', hashTexto: 'hash-qa' },
  ],
});

describe('WA-02 — automação WhatsApp com transporte simulado e Mongo isolado', () => {
  let app: INestApplication;
  let mongo: MongoMemoryServer;
  let conexao: Connection;
  let servico: WhatsAppService;
  let transporte: jest.MockedFunction<typeof fetch>;
  const anterior = Object.fromEntries(VARIAVEIS.map((v) => [v, process.env[v]]));

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.CIFRA_PEPPER = randomBytes(32).toString('hex');
    process.env.CIFRA_CHAVE_BASE64 = randomBytes(32).toString('base64');
    mongo = await MongoMemoryServer.create();
    const modulo = await Test.createTestingModule({
      imports: [MongooseModule.forRoot(mongo.getUri()), WhatsAppModule],
      providers: [{ provide: APP_GUARD, useClass: PapelGuard }],
    }).compile();
    app = modulo.createNestApplication({ rawBody: true });
    await app.init();
    conexao = app.get<Connection>(getConnectionToken());
    servico = app.get(WhatsAppService);
  });

  beforeEach(async () => {
    Object.assign(process.env, {
      WHATSAPP_ENVIO_ATIVO: 'true',
      WHATSAPP_API_VERSAO: 'v99.0',
      WHATSAPP_PHONE_NUMBER_ID: PHONE_ID,
      WHATSAPP_ACCESS_TOKEN: 'token-qa-sem-acesso-real-meta',
      WHATSAPP_TEMPLATE_BOAS_VINDAS: 'boas_vindas_qa',
      WHATSAPP_TEMPLATE_IDIOMA: 'pt_BR',
      WHATSAPP_APP_SECRET: SEGREDO_APP,
      WHATSAPP_VERIFY_TOKEN: VERIFY,
    });
    for (const nome of [
      'contatos',
      'whatsapp_fila',
      'whatsapp_recibos',
      'whatsapp_bloqueios',
      'acessos_dados',
    ]) {
      await conexao.collection(nome).deleteMany({});
    }
    await conexao
      .collection('whatsapp_controle')
      .updateOne(
        { _id: 'boas_vindas_v1' as never },
        { $set: { instaladoEm: new Date(Date.now() - 3_600_000) } },
      );
    transporte = jest.fn<
      ReturnType<typeof fetch>,
      Parameters<typeof fetch>
    >() as jest.MockedFunction<typeof fetch>;
    transporte.mockResolvedValue(
      new Response(JSON.stringify({ messages: [{ id: 'wamid.qa-1' }] }), { status: 200 }),
    );
    servico.fetchImpl = transporte;
  });

  afterAll(async () => {
    if (app) await app.close();
    if (mongo) await mongo.stop();
    for (const [nome, valor] of Object.entries(anterior)) {
      if (valor === undefined) delete process.env[nome];
      else process.env[nome] = valor;
    }
  });

  async function lead(campos: Record<string, unknown> = {}) {
    const id = new Types.ObjectId();
    await conexao.collection('contatos').insertOne({
      _id: id,
      idLocal: `qa-${id}`,
      nome: 'Lead QA',
      criadoEm: new Date(Date.now() - 1000),
      status: 'capturado',
      telefones: [{ e164: TELEFONE, principal: true }],
      lgpd: concessao(),
      ...campos,
    });
    return id;
  }
  async function trabalho(contatoId: Types.ObjectId) {
    const doc = await conexao.collection('whatsapp_fila').findOne({ contatoId });
    if (!doc) throw new Error('Trabalho esperado não foi criado');
    return doc;
  }
  async function tornarDevido() {
    await conexao
      .collection('whatsapp_fila')
      .updateMany({}, { $set: { proximaTentativaEm: new Date(0) } });
  }
  function outraInstancia() {
    const instancia = new WhatsAppService(
      conexao,
      app.get<Model<TrabalhoWhatsApp>>(getModelToken('WhatsAppTrabalho')),
      app.get<Model<ControleWhatsApp>>(getModelToken('WhatsAppControle')),
      app.get<Model<BloqueioWhatsApp>>(getModelToken('WhatsAppBloqueio')),
      app.get<Model<ReciboWhatsApp>>(getModelToken('WhatsAppRecibo')),
    );
    instancia.fetchImpl = transporte;
    return instancia;
  }
  function payload(valor: Record<string, unknown>, numeroId = PHONE_ID) {
    return {
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              field: 'messages',
              value: {
                metadata: { phone_number_id: numeroId },
                ...valor,
              },
            },
          ],
        },
      ],
    };
  }
  function assinar(raw: Buffer) {
    return `sha256=${createHmac('sha256', SEGREDO_APP).update(raw).digest('hex')}`;
  }
  async function recibo(estado: string, id = 'wamid.qa-1', numeroId = PHONE_ID) {
    const raw = Buffer.from(
      JSON.stringify(
        payload({ statuses: [{ id, status: estado, errors: [{ code: 131026 }] }] }, numeroId),
      ),
    );
    await servico.receberWebhook(raw, assinar(raw));
  }

  it('OFF conserva fila e baseline no Mongo sem consumir tentativa nem chamar a API, inclusive com configuração completa', async () => {
    process.env.WHATSAPP_ENVIO_ATIVO = 'false';
    const id = await lead();
    await servico.executarCiclo();
    const marco = await conexao
      .collection('whatsapp_controle')
      .findOne({ _id: 'boas_vindas_v1' as never });
    const reiniciado = outraInstancia();
    await reiniciado.onModuleInit();
    await reiniciado.executarCiclo();
    expect(await conexao.collection('whatsapp_fila').countDocuments({ contatoId: id })).toBe(1);
    expect(await trabalho(id)).toMatchObject({ estado: 'aguardando', tentativas: 0 });
    expect(
      (await conexao.collection('whatsapp_controle').findOne({ _id: 'boas_vindas_v1' as never }))
        ?.instaladoEm,
    ).toEqual(marco?.instaladoEm);
    expect(transporte).not.toHaveBeenCalled();
  });

  it('configuração incompleta e flag não literal true impedem qualquer HTTP externo', async () => {
    const id = await lead();
    process.env.WHATSAPP_ACCESS_TOKEN = '';
    await servico.executarCiclo();
    process.env.WHATSAPP_ACCESS_TOKEN = 'token-qa-sem-acesso-real-meta';
    process.env.WHATSAPP_ENVIO_ATIVO = '1';
    await servico.executarCiclo();
    expect(await trabalho(id)).toMatchObject({ tentativas: 0, estado: 'aguardando' });
    expect(transporte).not.toHaveBeenCalled();
  });

  it('não importa a base histórica nem dispara lead com mais de 24 horas', async () => {
    await lead({ criadoEm: new Date(Date.now() - 7_200_000) });
    await lead({ criadoEm: new Date(Date.now() - 90_000_000) });
    await servico.executarCiclo();
    expect(await conexao.collection('whatsapp_fila').countDocuments()).toBe(0);
    expect(transporte).not.toHaveBeenCalled();
  });

  it.each<[string, Record<string, unknown>, string]>([
    ['sem autorização', { lgpd: { contatoComercial: 'pendente' } }, 'sem_autorizacao'],
    [
      'sem prova do consentimento',
      { lgpd: { contatoComercial: 'concedido', consentimentos: [] } },
      'sem_autorizacao',
    ],
    ['sem telefone', { telefones: [] }, 'sem_telefone_valido'],
    ['telefone inválido', { telefones: [{ e164: '11999990042' }] }, 'sem_telefone_valido'],
    [
      'WhatsApp explicitamente recusado',
      { telefones: [{ e164: TELEFONE, whatsapp: false }] },
      'sem_telefone_valido',
    ],
  ])(
    'aguarda %s, preservando a captura permissiva e sem gastar tentativas',
    async (_caso, campos, motivo) => {
      const id = await lead(campos);
      await servico.executarCiclo();
      expect(await trabalho(id)).toMatchObject({ estado: 'aguardando', motivo, tentativas: 0 });
      expect(transporte).not.toHaveBeenCalled();
    },
  );

  it('consentimento posterior na janela habilita um único template, sem reenviar em edição ou reinício', async () => {
    const id = await lead({ lgpd: { contatoComercial: 'pendente' } });
    await servico.executarCiclo();
    await conexao.collection('contatos').updateOne({ _id: id }, { $set: { lgpd: concessao() } });
    await tornarDevido();
    await servico.executarCiclo();
    await conexao
      .collection('contatos')
      .updateOne({ _id: id }, { $set: { nome: 'Lead QA editado' } });
    await outraInstancia().executarCiclo();
    expect(transporte).toHaveBeenCalledTimes(1);
    const [url, opcoes] = transporte.mock.calls[0];
    expect(url).toBe(`https://graph.facebook.com/v99.0/${PHONE_ID}/messages`);
    expect(JSON.parse(String(opcoes?.body))).toEqual({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: TELEFONE.slice(1),
      type: 'template',
      template: { name: 'boas_vindas_qa', language: { code: 'pt_BR' } },
    });
    expect(await trabalho(id)).toMatchObject({
      estado: 'aceito',
      tentativas: 1,
      mensagemId: 'wamid.qa-1',
    });
    const salvo = JSON.stringify(await trabalho(id));
    expect(salvo).not.toContain(TELEFONE);
    expect(salvo).not.toContain('token-qa-sem-acesso-real-meta');
    expect(salvo).not.toContain('Lead QA');
  });

  it.each<[string, Record<string, unknown>]>([
    ['revogado', { 'lgpd.revogadoEm': new Date() }],
    ['eliminado', { 'lgpd.eliminadoEm': new Date() }],
    ['fundido', { fundidoEm: new Types.ObjectId() }],
    ['descartado', { status: 'descartado' }],
  ])('reconsulta o contato %s antes de enviar e cancela a fila', async (_caso, alteracoes) => {
    process.env.WHATSAPP_ENVIO_ATIVO = 'false';
    const id = await lead();
    await servico.executarCiclo();
    await conexao.collection('contatos').updateOne({ _id: id }, { $set: alteracoes });
    process.env.WHATSAPP_ENVIO_ATIVO = 'true';
    await servico.executarCiclo();
    expect(await trabalho(id)).toMatchObject({ estado: 'cancelado', tentativas: 0 });
    expect(transporte).not.toHaveBeenCalled();
  });

  it('expira trabalhos abertos e não tenta enviar depois da janela', async () => {
    process.env.WHATSAPP_ENVIO_ATIVO = 'false';
    const id = await lead();
    await servico.executarCiclo();
    await conexao
      .collection('whatsapp_fila')
      .updateOne({ contatoId: id }, { $set: { expiraEm: new Date(0) } });
    process.env.WHATSAPP_ENVIO_ATIVO = 'true';
    await servico.executarCiclo();
    expect(await trabalho(id)).toMatchObject({ estado: 'expirado', tentativas: 0 });
    expect(transporte).not.toHaveBeenCalled();
  });

  it('duas instâncias concorrentes reservam o mesmo lead apenas uma vez', async () => {
    const id = await lead();
    const segunda = outraInstancia();
    await Promise.all([servico.executarCiclo(), segunda.executarCiclo(), servico.executarCiclo()]);
    expect(transporte).toHaveBeenCalledTimes(1);
    expect(await conexao.collection('whatsapp_fila').countDocuments({ contatoId: id })).toBe(1);
    expect(await trabalho(id)).toMatchObject({ estado: 'aceito', tentativas: 1 });
  });

  it('reserva expirada após queda vira incerta e não faz reenvio automático', async () => {
    process.env.WHATSAPP_ENVIO_ATIVO = 'false';
    const id = await lead();
    await servico.executarCiclo();
    await conexao.collection('whatsapp_fila').updateOne(
      { contatoId: id },
      {
        $set: {
          estado: 'processando',
          reservaId: 'processo-que-caiu',
          reservaAte: new Date(0),
          tentativas: 1,
        },
      },
    );
    process.env.WHATSAPP_ENVIO_ATIVO = 'true';
    await outraInstancia().executarCiclo();
    expect(await trabalho(id)).toMatchObject({ estado: 'incerto', tentativas: 1 });
    expect(transporte).not.toHaveBeenCalled();
  });

  it('429 agenda retentativas com backoff/Retry-After e para após cinco rejeições', async () => {
    const id = await lead();
    transporte.mockImplementation(
      async () => new Response('{}', { status: 429, headers: { 'retry-after': '120' } }),
    );
    const inicio = Date.now();
    await servico.executarCiclo();
    expect(await trabalho(id)).toMatchObject({ estado: 'pendente', tentativas: 1 });
    expect((await trabalho(id)).proximaTentativaEm.getTime()).toBeGreaterThanOrEqual(
      inicio + 120_000,
    );
    await servico.executarCiclo();
    expect(transporte).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 4; i += 1) {
      await tornarDevido();
      await servico.executarCiclo();
    }
    expect(await trabalho(id)).toMatchObject({
      estado: 'falha',
      tentativas: 5,
      motivo: 'limite_tentativas',
    });
    await tornarDevido();
    await servico.executarCiclo();
    expect(transporte).toHaveBeenCalledTimes(5);
  });

  it('Retry-After de 7200 segundos não é antecipado pelo teto local de uma hora', async () => {
    const id = await lead();
    transporte.mockImplementation(
      async () => new Response('{}', { status: 429, headers: { 'retry-after': '7200' } }),
    );
    const inicio = Date.now();
    await servico.executarCiclo();
    const agendado = await trabalho(id);
    expect(agendado).toMatchObject({ estado: 'pendente', tentativas: 1 });
    expect(agendado.proximaTentativaEm.getTime()).toBeGreaterThanOrEqual(inicio + 7_200_000);
    await servico.executarCiclo();
    expect(transporte).toHaveBeenCalledTimes(1);
  });

  it('Retry-After em HTTP-date futuro não é antecipado nem substituído pelo backoff local', async () => {
    const id = await lead();
    const dataHttp = new Date(Date.now() + 7_200_000).toUTCString();
    transporte.mockImplementation(
      async () => new Response('{}', { status: 429, headers: { 'retry-after': dataHttp } }),
    );
    await servico.executarCiclo();
    const agendado = await trabalho(id);
    expect(agendado).toMatchObject({ estado: 'pendente', tentativas: 1 });
    expect(agendado.proximaTentativaEm.getTime()).toBeGreaterThanOrEqual(Date.parse(dataHttp));
    await servico.executarCiclo();
    expect(transporte).toHaveBeenCalledTimes(1);
  });

  it('Retry-After além da janela do lead expira o trabalho sem agendar reenvio antecipado', async () => {
    const id = await lead();
    transporte.mockImplementation(
      async () => new Response('{}', { status: 429, headers: { 'retry-after': '90000' } }),
    );
    await servico.executarCiclo();
    expect(await trabalho(id)).toMatchObject({ estado: 'expirado', tentativas: 1 });
    await tornarDevido();
    await servico.executarCiclo();
    expect(transporte).toHaveBeenCalledTimes(1);
  });

  it.each([500, 408, 'timeout', 'sem_id'])(
    'resultado ambíguo %s vira incerto sem reenvio cego',
    async (caso) => {
      const id = await lead();
      transporte.mockImplementation(async () => {
        if (caso === 'timeout') throw new Error('timeout simulado');
        return new Response('{}', { status: typeof caso === 'number' ? caso : 200 });
      });
      await servico.executarCiclo();
      await tornarDevido();
      await servico.executarCiclo();
      expect(await trabalho(id)).toMatchObject({ estado: 'incerto', tentativas: 1 });
      expect(transporte).toHaveBeenCalledTimes(1);
    },
  );

  it('erro definitivo 400 termina sem retry e não grava o corpo sensível do provedor', async () => {
    const id = await lead();
    transporte.mockResolvedValue(
      new Response(JSON.stringify({ error: { message: `erro ${TELEFONE}` } }), { status: 400 }),
    );
    await servico.executarCiclo();
    await servico.executarCiclo();
    expect(await trabalho(id)).toMatchObject({
      estado: 'falha',
      motivo: 'http_400',
      tentativas: 1,
    });
    expect(JSON.stringify(await trabalho(id))).not.toContain(TELEFONE);
    expect(transporte).toHaveBeenCalledTimes(1);
  });

  it('aceite HTTP não prova entrega; recibos assinados são idempotentes e não regridem leitura', async () => {
    const id = await lead();
    await servico.executarCiclo();
    expect((await trabalho(id)).estado).toBe('aceito');
    await recibo('delivered');
    expect((await trabalho(id)).estado).toBe('entregue');
    await recibo('delivered');
    await recibo('sent');
    expect((await trabalho(id)).estado).toBe('entregue');
    await recibo('read');
    await recibo('failed');
    expect((await trabalho(id)).estado).toBe('lido');
    expect(transporte).toHaveBeenCalledTimes(1);
  });

  it('recibo que chega antes da resposta do envio é aplicado após persistir wamid', async () => {
    const id = await lead();
    transporte.mockImplementation(async () => {
      await recibo('delivered', 'wamid.qa-antes');
      return new Response(JSON.stringify({ messages: [{ id: 'wamid.qa-antes' }] }), {
        status: 200,
      });
    });
    await servico.executarCiclo();
    expect(await trabalho(id)).toMatchObject({ mensagemId: 'wamid.qa-antes', estado: 'entregue' });
  });

  it('ignora recibo de outro número empresarial mesmo com assinatura válida', async () => {
    const id = await lead();
    await servico.executarCiclo();
    await recibo('read', 'wamid.qa-1', '999999999999999');
    expect((await trabalho(id)).estado).toBe('aceito');
    expect(await conexao.collection('whatsapp_recibos').countDocuments()).toBe(0);
  });

  it('STOP assinado bloqueia por hash e impede novos leads com o mesmo telefone, inclusive com envio OFF', async () => {
    process.env.WHATSAPP_ENVIO_ATIVO = 'false';
    const id = await lead();
    await servico.executarCiclo();
    const raw = Buffer.from(
      JSON.stringify(
        payload({
          messages: [{ from: TELEFONE.slice(1), type: 'text', text: { body: ' SAIR ' } }],
        }),
      ),
    );
    await servico.receberWebhook(raw, assinar(raw));
    const segundo = await lead();
    process.env.WHATSAPP_ENVIO_ATIVO = 'true';
    await servico.executarCiclo();
    expect((await trabalho(id)).estado).toBe('cancelado');
    expect((await trabalho(segundo)).estado).toBe('cancelado');
    const bloqueios = await conexao.collection('whatsapp_bloqueios').find().toArray();
    expect(bloqueios).toHaveLength(1);
    expect(JSON.stringify(bloqueios)).not.toContain(TELEFONE.slice(1));
    expect(JSON.stringify(bloqueios)).not.toContain('SAIR');
    expect(transporte).not.toHaveBeenCalled();
  });

  it('status exige gestor/admin e mostra somente configuração e agregados, com acesso auditado', async () => {
    process.env.WHATSAPP_ENVIO_ATIVO = 'false';
    await lead();
    await servico.executarCiclo();
    expect((await request(app.getHttpServer()).get('/v1/whatsapp/status')).status).toBe(403);
    for (const papel of ['vendedor', 'auditor']) {
      expect(
        (
          await request(app.getHttpServer())
            .get('/v1/whatsapp/status')
            .set({ 'x-papel-teste': papel, 'x-usuario-id': ADMIN })
        ).status,
      ).toBe(403);
    }
    for (const papel of ['gestor', 'admin']) {
      const resposta = await request(app.getHttpServer())
        .get('/v1/whatsapp/status')
        .set({ 'x-papel-teste': papel, 'x-usuario-id': ADMIN });
      expect(resposta.status).toBe(200);
      expect(resposta.body).toMatchObject({
        envioAtivo: false,
        modo: 'desativado',
        fila: { aguardando: 1 },
      });
      const texto = JSON.stringify(resposta.body);
      expect(texto).not.toContain(TELEFONE);
      expect(texto).not.toContain(process.env.WHATSAPP_ACCESS_TOKEN);
      expect(texto).not.toContain(SEGREDO_APP);
      expect(texto).not.toContain('Lead QA');
    }
    expect(
      await conexao.collection('acessos_dados').countDocuments({ acao: 'whatsapp_status' }),
    ).toBe(2);
  });

  it('handshake é público, exige verify-token e devolve challenge como texto', async () => {
    const rota = '/v1/whatsapp/webhook';
    const valida = await request(app.getHttpServer())
      .get(rota)
      .query({ 'hub.mode': 'subscribe', 'hub.verify_token': VERIFY, 'hub.challenge': '123456' });
    expect(valida.status).toBe(200);
    expect(valida.text).toBe('123456');
    expect(
      (
        await request(app.getHttpServer()).get(rota).query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'errado',
          'hub.challenge': '123456',
        })
      ).status,
    ).toBe(403);
  });

  it('POST público retorna 200 com raw-body assinado, rejeita assinatura ausente/adulterada sem gravar', async () => {
    const raw = Buffer.from(
      JSON.stringify(payload({ statuses: [{ id: 'wamid.qa-webhook', status: 'read' }] })),
    );
    const rota = '/v1/whatsapp/webhook';
    expect(
      (
        await request(app.getHttpServer())
          .post(rota)
          .set('content-type', 'application/json')
          .send(raw.toString())
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app.getHttpServer())
          .post(rota)
          .set({
            'content-type': 'application/json',
            'x-hub-signature-256': `sha256=${'0'.repeat(64)}`,
          })
          .send(raw.toString())
      ).status,
    ).toBe(403);
    expect(await conexao.collection('whatsapp_recibos').countDocuments()).toBe(0);
    const valida = await request(app.getHttpServer())
      .post(rota)
      .set({ 'content-type': 'application/json', 'x-hub-signature-256': assinar(raw) })
      .send(raw.toString());
    expect(valida.status).toBe(200);
    expect(valida.body).toEqual({ recebido: true });
    expect(
      await conexao
        .collection('whatsapp_recibos')
        .countDocuments({ mensagemId: 'wamid.qa-webhook', lido: true }),
    ).toBe(1);
  });

  it('payloads malformados assinados são limitados e não alteram dados nem fazem HTTP', async () => {
    const naoJson = Buffer.from('{');
    await expect(servico.receberWebhook(naoJson, assinar(naoJson))).rejects.toMatchObject({
      status: 400,
    });
    const enorme = Buffer.from('a'.repeat(100_001));
    await expect(servico.receberWebhook(enorme, assinar(enorme))).rejects.toMatchObject({
      status: 403,
    });
    const inesperado = Buffer.from(
      JSON.stringify({
        object: 'whatsapp_business_account',
        entry: [null, { changes: [null, {}, { value: null }] }],
      }),
    );
    await expect(servico.receberWebhook(inesperado, assinar(inesperado))).resolves.toBeUndefined();
    expect(await conexao.collection('whatsapp_recibos').countDocuments()).toBe(0);
    expect(transporte).not.toHaveBeenCalled();
  });
});
