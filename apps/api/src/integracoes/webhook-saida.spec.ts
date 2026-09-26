import { createHmac, randomBytes } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { getConnectionToken, getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Types, type Connection, type Model } from 'mongoose';
import request from 'supertest';
import { AuthModule } from '../auth/auth.module';
import { ContatosModule } from '../contatos/contatos.module';
import { garantirIndices } from '../contatos/schemas/registrar-modelos';
import { IntegracoesModule } from './integracoes.module';
import { WebhookSaidaService } from './webhook-saida.service';

const GESTOR = new Types.ObjectId().toHexString();
const URL = 'http://127.0.0.1:9/v1/integracao/contatos-promovidos';
const SEGREDO = 'segredo-de-teste-nao-e-producao';

describe('webhook de saída', () => {
  let app: INestApplication;
  let memoria: MongoMemoryServer;
  let servico: WebhookSaidaService;
  let fila: Model<LinhaWebhook>;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.CIFRA_CHAVE_BASE64 = randomBytes(32).toString('base64');
    process.env.CIFRA_PEPPER = randomBytes(32).toString('hex');
    delete process.env.ERP_WEBHOOK_URL;
    delete process.env.ERP_WEBHOOK_SEGREDO;
    memoria = await MongoMemoryServer.create();
    const modulo = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(memoria.getUri()),
        AuthModule,
        ContatosModule,
        IntegracoesModule,
      ],
    }).compile();
    app = modulo.createNestApplication();
    await app.init();
    await garantirIndices(app.get<Connection>(getConnectionToken()));
    servico = app.get(WebhookSaidaService);
    fila = app.get(getModelToken('WebhookSaida'));
  });

  afterEach(() => {
    delete process.env.ERP_WEBHOOK_URL;
    delete process.env.ERP_WEBHOOK_SEGREDO;
    delete process.env.ERP_WEBHOOK_INTERVALO_MS;
    servico.fetchImpl = fetch;
  });

  afterAll(async () => {
    await app.close();
    await memoria.stop();
  });

  it('não chama a rede sem destino e não trava a promoção', async () => {
    let chamadas = 0;
    servico.fetchImpl = async () => {
      chamadas += 1;
      throw new Error('não deveria sair');
    };
    const id = await qualificar(app, 'Webhook Sem Destino');
    const promovido = await request(app.getHttpServer())
      .post(`/v1/contatos/${id}/transicao`)
      .set(cabecalho(true))
      .send({ para: 'cliente' });
    expect(promovido.status).toBe(201);
    const entrega = await esperarEntrega(fila, id);
    expect(entrega?.status).toBe('sem_consentimento');
    expect(chamadas).toBe(0);
  });

  it('assina o corpo, não repete a mesma versão e retenta com backoff', async () => {
    process.env.ERP_WEBHOOK_URL = URL;
    process.env.ERP_WEBHOOK_SEGREDO = SEGREDO;
    process.env.ERP_WEBHOOK_INTERVALO_MS = '15';
    const vistos: string[] = [];
    const assinaturas: string[] = [];
    let falhas = 0;
    servico.fetchImpl = async (_url, init) => {
      const corpo = String(init?.body ?? '');
      vistos.push(corpo);
      const headers = init?.headers as Record<string, string>;
      assinaturas.push(headers['X-Captura7-Assinatura']);
      if (falhas === 0) {
        falhas += 1;
        return new Response('fora', { status: 503 });
      }
      return new Response(null, { status: 204 });
    };
    const contatoId = await contatoComErp(app);
    const evento = {
      contatoId,
      versao: 4,
      autorId: GESTOR,
      em: '2026-09-26T00:00:00.000Z',
    };
    await servico.enfileirar(evento);
    await servico.enfileirar(evento);
    const entrega = await esperarStatus(fila, `${evento.contatoId}:4`, 'entregue');
    expect(entrega?.status).toBe('entregue');
    expect(vistos.length).toBeGreaterThanOrEqual(2);
    expect(new Set(vistos).size).toBe(1);
    const esperado = createHmac('sha256', SEGREDO).update(vistos[0]).digest('hex');
    expect(assinaturas[0]).toBe(esperado);
    expect(vistos[0]).toContain('"versaoContrato":"v1"');
    expect(vistos[0]).toContain('"/v1/integracao/contatos-promovidos"');
  });

  it('trata placeholder como destino desligado', async () => {
    process.env.ERP_WEBHOOK_URL = 'preencha-com-url-do-webhook';
    process.env.ERP_WEBHOOK_SEGREDO = 'preencha-com-segredo-hmac';
    let chamadas = 0;
    servico.fetchImpl = async () => {
      chamadas += 1;
      return new Response(null, { status: 204 });
    };
    const contatoId = new Types.ObjectId().toHexString();
    await servico.enfileirar({
      contatoId,
      versao: 2,
      autorId: GESTOR,
      em: '2026-09-26T00:00:00.000Z',
    });
    const doc = await fila.findOne({ chaveIdempotencia: `${contatoId}:2` }).lean();
    expect(doc?.status).toBe('sem_consentimento');
    expect(chamadas).toBe(0);
    const comConsentimento = await contatoComErp(app);
    await servico.enfileirar({
      contatoId: comConsentimento,
      versao: 2,
      autorId: GESTOR,
      em: '2026-09-26T00:00:00.000Z',
    });
    const configurado = await fila.findOne({ chaveIdempotencia: `${comConsentimento}:2` }).lean();
    expect(configurado?.status).toBe('nao_configurado');
    expect(chamadas).toBe(0);
  });
});

async function contatoComErp(app: INestApplication): Promise<string> {
  const Contato = app.get(getModelToken('Contato'));
  const doc = await Contato.create({
    nome: 'Cliente com ERP',
    status: 'cliente',
    lgpd: {
      contatoComercial: 'concedido',
      consentimentos: [
        {
          finalidade: 'envio_erp',
          emServidor: new Date(),
          versaoTermo: '[A PREENCHER, D1]',
          hashTexto: 'prova',
          canal: 'autocadastro',
        },
      ],
    },
  });
  return String(doc._id);
}

async function qualificar(app: INestApplication, nome: string): Promise<string> {
  const criado = await request(app.getHttpServer())
    .post('/v1/contatos')
    .set(cabecalho(false))
    .send({
      nome,
      telefone: '11944443333',
      email: 'webhook-sem-destino@exemplo.com',
      cpf: '52998224725',
      logradouro: 'Rua B',
      numero: '20',
      cidade: 'São Paulo',
      uf: 'SP',
    });
  expect(criado.status).toBe(201);
  const id = criado.body.dados._id as string;
  const qualificado = await request(app.getHttpServer())
    .post(`/v1/contatos/${id}/transicao`)
    .set(cabecalho(false))
    .send({ para: 'qualificado' });
  expect(qualificado.status).toBe(201);
  return id;
}

function cabecalho(passo: boolean): Record<string, string> {
  return {
    'x-papel-teste': 'gestor',
    'x-usuario-id': GESTOR,
    'x-autor-nome': 'Gestor do webhook',
    ...(passo ? { 'x-step-up-teste': '1' } : {}),
  };
}

interface LinhaWebhook {
  status: string;
  corpoJson: string;
  chaveIdempotencia: string;
  contatoId: string;
}

async function esperarEntrega(
  fila: Model<LinhaWebhook>,
  contatoId: string,
): Promise<LinhaWebhook | null> {
  const inicio = Date.now();
  while (Date.now() - inicio < 2000) {
    const doc = await fila.findOne({ contatoId }).lean<LinhaWebhook | null>();
    if (doc && doc.status !== 'pendente') return doc;
    await new Promise((resolver) => setTimeout(resolver, 20));
  }
  return null;
}

async function esperarStatus(
  fila: Model<LinhaWebhook>,
  chave: string,
  status: string,
): Promise<LinhaWebhook | null> {
  const inicio = Date.now();
  while (Date.now() - inicio < 2000) {
    const doc = await fila.findOne({ chaveIdempotencia: chave }).lean<LinhaWebhook | null>();
    if (doc?.status === status) return doc;
    await new Promise((resolver) => setTimeout(resolver, 20));
  }
  return fila.findOne({ chaveIdempotencia: chave }).lean<LinhaWebhook | null>();
}
