import { randomBytes } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { getConnectionToken, getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Types, type Connection, type Model } from 'mongoose';
import request from 'supertest';
import { AuthModule } from '../auth/auth.module';
import { ContatosModule } from '../contatos/contatos.module';
import { AuditoriaImutavel } from '../contatos/schemas/erro-nomeado';
import { garantirIndices } from '../contatos/schemas/registrar-modelos';
import { LgpdModule } from './lgpd.module';
import { zerarPedidosPublicos } from './pedidos-publicos';
import { textoDoTermo } from './texto-termo';

const VENDEDOR = new Types.ObjectId().toHexString();
const OUTRO = new Types.ObjectId().toHexString();
const GESTOR = new Types.ObjectId().toHexString();

describe('termo de consentimento', () => {
  let app: INestApplication;
  let memoria: MongoMemoryServer;

  beforeAll(async () => {
    process.env.CONTROLADOR_EMAIL = 'erico@exemplo.com';
    process.env.NODE_ENV = 'test';
    process.env.CIFRA_CHAVE_BASE64 = randomBytes(32).toString('base64');
    process.env.CIFRA_PEPPER = randomBytes(32).toString('hex');
    delete process.env.AUDITORIA_PRAZO_GUARDA_DIAS;
    memoria = await MongoMemoryServer.create();
    const modulo = await Test.createTestingModule({
      imports: [MongooseModule.forRoot(memoria.getUri()), AuthModule, ContatosModule, LgpdModule],
    }).compile();
    app = modulo.createNestApplication();
    await app.init();
    await garantirIndices(app.get<Connection>(getConnectionToken()));
  });

  beforeEach(() => {
    zerarPedidosPublicos();
  });

  afterAll(async () => {
    await app.close();
    await memoria.stop();
  });

  it('publica o termo do controlador pessoa física', async () => {
    const resposta = await request(app.getHttpServer()).get('/v1/publico/termo/atual');
    expect(resposta.status).toBe(200);
    expect(resposta.body.dados.versao).toBe('2026-09-26-uso-pessoal');
    const curto = String(resposta.body.dados.textoCurto);
    expect(curto).toContain('Erico Henrique de Lima Araujo');
    expect(curto).toContain('erico@exemplo.com');
    expect(curto).toMatch(/24 meses[\s\S]*180 dias[\s\S]*30 dias/);
    expect(String(resposta.body.dados.textoCompleto)).not.toContain('quando você pede');
    expect(resposta.body.dados.textoCompleto).toContain('computador local do controlador');
    expect(curto).not.toContain('[A PREENCHER');
    expect(resposta.body.dados.hash).toBe(textoDoTermo().hash);
    expect(resposta.body.dados.textoCompleto).toContain('Art. 18, VI');
  });

  it('salva a captura mínima com consentimento pendente', async () => {
    const resposta = await request(app.getHttpServer())
      .post('/v1/contatos')
      .set(cabecalho('vendedor', VENDEDOR))
      .send({ nome: 'Ana Campo' });
    expect(resposta.status).toBe(201);
    expect(resposta.body.dados.lgpd.contatoComercial).toBe('pendente');
    expect(resposta.body.dados.lgpd.consentimentos).toEqual([]);
    const bloqueio = await request(app.getHttpServer())
      .post(`/v1/contatos/${resposta.body.dados._id}/contato-comercial`)
      .set(cabecalho('vendedor', VENDEDOR));
    expect(bloqueio.status).toBe(403);
    expect(bloqueio.body.erros[0].codigo).toBe('CONTATO_COMERCIAL_BLOQUEADO');
  });

  it('não conclui o autocadastro sem a caixa e conclui com prova quando ela vem marcada', async () => {
    const qr = await request(app.getHttpServer())
      .post('/v1/qr')
      .set(cabecalho('vendedor', VENDEDOR));
    expect(qr.status).toBe(201);
    const token = qr.body.dados.token as string;
    const antes = await app.get<Model<unknown>>(getModelToken('Contato')).countDocuments();
    const recusado = await postarPublico(app, {
      token,
      nome: 'Sem Caixa',
      contatoComercial: false,
    });
    expect(recusado.status).toBe(422);
    expect(recusado.body.erros[0].codigo).toBe('CONSENTIMENTO_OBRIGATORIO');
    expect(await app.get<Model<unknown>>(getModelToken('Contato')).countDocuments()).toBe(antes);
    const emDispositivo = '2020-01-01T00:00:00.000Z';
    const aceito = await postarPublico(app, {
      token,
      nome: 'Com Caixa',
      email: 'caixa@exemplo.com',
      contatoComercial: true,
      emDispositivo,
    });
    expect(aceito.status).toBe(201);
    expect(aceito.body.dados.lgpd.contatoComercial).toBe('concedido');
    expect(aceito.body.dados.lgpd.baseLegal).toBe('consentimento');
    const prova = aceito.body.dados.lgpd.consentimentos[0];
    expect(prova.finalidade).toBe('contato_comercial');
    expect(prova.canal).toBe('autocadastro');
    expect(prova.versaoTermo).toBe('2026-09-26-uso-pessoal');
    expect(prova.hashTexto).toBe(textoDoTermo().hash);
    expect(new Date(prova.emDispositivo).toISOString()).toBe(emDispositivo);
    expect(prova.emServidor).toBeTruthy();
    expect(String(prova.responsavelId)).toBe(VENDEDOR);
    expect(JSON.stringify(prova)).not.toContain('Vendedor');
    const liberado = await request(app.getHttpServer())
      .post(`/v1/contatos/${aceito.body.dados._id}/contato-comercial`)
      .set(cabecalho('gestor', GESTOR));
    expect(liberado.status).toBe(201);
  });

  it('recusa o autocadastro sem o desafio e aceita a conta certa', async () => {
    const token = await emitirQr();
    const sem = await request(app.getHttpServer())
      .post('/v1/publico/autocadastro')
      .send({ token, nome: 'Sem Desafio', contatoComercial: true });
    expect(sem.status).toBe(422);
    expect(sem.body.erros[0].codigo).toBe('CAPTCHA_INVALIDO');
    const ok = await postarPublico(app, { token, nome: 'Com Desafio', contatoComercial: true });
    expect(ok.status).toBe(201);
  });

  it('expira, gasta uma vez e revoga o token do QR', async () => {
    const token = await emitirQr();
    const modelo = app.get<Model<{ expiraEm: Date; usos: number }>>(
      getModelToken('TokenAutocadastro'),
    );
    await modelo.updateOne({ token }, { $set: { expiraEm: new Date(Date.now() - 1000) } });
    const expirado = await concluir(token, 'Expirado');
    expect(expirado.status).toBe(410);
    expect(expirado.body.erros[0].codigo).toBe('TOKEN_EXPIRADO');

    await modelo.updateOne(
      { token },
      { $set: { expiraEm: new Date(Date.now() + 60_000), usos: 0, limiteUsos: 1 } },
    );
    expect((await concluir(token, 'Primeiro Uso')).status).toBe(201);
    const esgotado = await concluir(token, 'Segundo Uso');
    expect(esgotado.status).toBe(410);
    expect(esgotado.body.erros[0].codigo).toBe('TOKEN_ESGOTADO');

    const fresco = await emitirQr();
    const alheio = await request(app.getHttpServer())
      .post(`/v1/qr/${fresco}/revogar`)
      .set(cabecalho('vendedor', OUTRO));
    expect(alheio.status).toBe(403);
    const revogado = await request(app.getHttpServer())
      .post(`/v1/qr/${fresco}/revogar`)
      .set(cabecalho('vendedor', VENDEDOR));
    expect(revogado.status).toBe(201);
    zerarPedidosPublicos();
    const depois = await concluir(fresco, 'Revogado');
    expect(depois.status).toBe(410);
    expect(depois.body.erros[0].codigo).toBe('TOKEN_REVOGADO');
  });

  it('não soma o limite de visitantes diferentes atrás do proxy', async () => {
    const http = app.getHttpAdapter().getInstance() as {
      set: (chave: string, valor: unknown) => void;
    };
    http.set('trust proxy', 1);
    for (let i = 0; i < 3; i += 1) {
      const token = await emitirQr();
      const ok = await postarPublico(
        app,
        { token, nome: `Proxy ${i}`, contatoComercial: true },
        '203.0.113.10',
      );
      expect(ok.status).toBe(201);
    }
    const tokenQuarto = await emitirQr();
    const quarto = await request(app.getHttpServer())
      .post('/v1/publico/autocadastro')
      .set('X-Forwarded-For', '203.0.113.10')
      .send({ token: tokenQuarto, nome: 'Proxy Quarto', contatoComercial: true });
    expect(quarto.status).toBe(422);
    expect(quarto.body.erros[0].codigo).toBe('CAPTCHA_INVALIDO');
    const tokenOutro = await emitirQr();
    const outro = await postarPublico(
      app,
      { token: tokenOutro, nome: 'Outro Visitante', contatoComercial: true },
      '203.0.113.11',
    );
    expect(outro.status).toBe(201);
    http.set('trust proxy', false);
  });

  it('revoga na hora e elimina sem reescrever a trilha nem deixar o nome em claro', async () => {
    const criado = await request(app.getHttpServer())
      .post('/v1/contatos')
      .set(cabecalho('vendedor', VENDEDOR))
      .send({
        nome: 'Elisa',
        telefone: '11955554444',
        email: 'elisa@exemplo.com',
        cpf: '39053344705',
      });
    const id = criado.body.dados._id as string;
    const concedido = await request(app.getHttpServer())
      .post(`/v1/contatos/${id}/consentimento`)
      .set(cabecalho('vendedor', VENDEDOR))
      .send({ contatoComercial: true, emDispositivo: '2024-05-01T12:00:00.000Z' });
    expect(concedido.status).toBe(201);
    expect(concedido.body.dados.lgpd.consentimentos[0].canal).toBe('vendedor_evento');
    const patch = await request(app.getHttpServer())
      .patch(`/v1/contatos/${id}`)
      .set(cabecalho('vendedor', VENDEDOR))
      .send({ campo: 'nome', valor: 'Elisa Souza', versaoConhecida: concedido.body.dados.versao });
    expect(patch.status).toBe(200);
    const Auditoria = app.get<Model<{ valorAnterior: unknown }>>(getModelToken('ContatoAuditoria'));
    const antes = await Auditoria.find({ contatoId: id }).lean();
    expect(antes.length).toBeGreaterThan(0);
    const foto = JSON.stringify(antes);
    const cru = (caminho: string, corpo: object = {}) =>
      request(app.getHttpServer()).post(caminho).set(cabecalho('gestor', GESTOR)).send(corpo);
    expect((await cru(`/v1/contatos/${id}/revogacao`)).status).toBe(422);
    const revogado = await cru(`/v1/contatos/${id}/revogacao`, { confirmar: true });
    expect(revogado.status).toBe(201);
    expect(revogado.body.dados.lgpd.contatoComercial).toBe('revogado');
    const bloqueio = await request(app.getHttpServer())
      .post(`/v1/contatos/${id}/contato-comercial`)
      .set(cabecalho('gestor', GESTOR));
    expect(bloqueio.status).toBe(403);
    const vendedor = await request(app.getHttpServer())
      .post(`/v1/contatos/${id}/eliminacao`)
      .set(cabecalho('vendedor', VENDEDOR));
    expect(vendedor.status).toBe(403);
    expect((await cru(`/v1/contatos/${id}/eliminacao`, { confirmacao: 'nao' })).status).toBe(422);
    const eliminado = await cru(`/v1/contatos/${id}/eliminacao`, { confirmacao: 'ELIMINAR' });
    expect(eliminado.status).toBe(201);
    expect(eliminado.body.dados.nome ?? null).toBeNull();
    expect(JSON.stringify(eliminado.body.dados.emails)).toBe('[]');
    expect(JSON.stringify(eliminado.body.dados)).not.toContain('Elisa');
    expect(JSON.stringify(eliminado.body.dados)).not.toContain('elisa@exemplo.com');
    const depois = await Auditoria.find({ contatoId: id }).lean();
    const trilha = JSON.stringify(depois);
    expect(trilha).not.toContain('Elisa');
    expect(trilha).not.toContain('elisa@exemplo.com');
    expect(trilha).not.toContain('11955554444');
    expect(trilha.startsWith(foto.slice(0, 2))).toBe(true);
    const primeira = await Auditoria.findById(antes[0]?._id).lean();
    expect(JSON.stringify(primeira)).toBe(JSON.stringify(antes[0]));
    await expect(
      Auditoria.updateOne({ _id: antes[0]?._id }, { valorNovo: 'Elisa' }),
    ).rejects.toBeInstanceOf(AuditoriaImutavel);
  });

  async function emitirQr(): Promise<string> {
    const qr = await request(app.getHttpServer())
      .post('/v1/qr')
      .set(cabecalho('vendedor', VENDEDOR));
    expect(qr.status).toBe(201);
    return qr.body.dados.token as string;
  }

  async function concluir(token: string, nome: string) {
    return postarPublico(app, { token, nome, contatoComercial: true });
  }
});

async function postarPublico(app: INestApplication, corpo: Record<string, unknown>, ip?: string) {
  const completo = await comCaptcha(app, corpo);
  const pedido = request(app.getHttpServer()).post('/v1/publico/autocadastro');
  if (ip) pedido.set('X-Forwarded-For', ip);
  return pedido.send(completo);
}

async function comCaptcha(
  app: INestApplication,
  corpo: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const desafio = await request(app.getHttpServer()).get('/v1/publico/captcha');
  const pergunta = String(desafio.body.dados.pergunta);
  const numeros = pergunta.match(/\d+/g)?.map(Number) ?? [0, 0];
  return {
    ...corpo,
    captchaId: desafio.body.dados.id,
    captchaResposta: String((numeros[0] ?? 0) + (numeros[1] ?? 0)),
  };
}

function cabecalho(papel: string, id: string): Record<string, string> {
  return {
    'x-papel-teste': papel,
    'x-usuario-id': id,
    'x-autor-nome': papel === 'gestor' ? 'Gestor Termo' : 'Vendedor Termo',
  };
}
