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
const GESTOR = new Types.ObjectId().toHexString();

describe('termo de consentimento', () => {
  let app: INestApplication;
  let memoria: MongoMemoryServer;

  beforeAll(async () => {
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

  it('publica a minuta com os colchetes e não inventa versão', async () => {
    const resposta = await request(app.getHttpServer()).get('/v1/publico/termo/atual');
    expect(resposta.status).toBe(200);
    expect(resposta.body.dados.versao).toBe('[A PREENCHER, D1]');
    expect(resposta.body.dados.textoCurto).toContain('[A PREENCHER, D1]');
    expect(resposta.body.dados.textoCurto).toContain('DECISÃO D5');
    expect(resposta.body.dados.textoCurto).toContain('DECISÃO D7');
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
    const recusado = await request(app.getHttpServer())
      .post('/v1/publico/autocadastro')
      .send({ token, nome: 'Sem Caixa', contatoComercial: false });
    expect(recusado.status).toBe(422);
    expect(recusado.body.erros[0].codigo).toBe('CONSENTIMENTO_OBRIGATORIO');
    expect(await app.get<Model<unknown>>(getModelToken('Contato')).countDocuments()).toBe(antes);
    const emDispositivo = '2020-01-01T00:00:00.000Z';
    const aceito = await request(app.getHttpServer()).post('/v1/publico/autocadastro').send({
      token,
      nome: 'Com Caixa',
      email: 'caixa@exemplo.com',
      contatoComercial: true,
      emDispositivo,
    });
    expect(aceito.status).toBe(201);
    expect(aceito.body.dados.lgpd.contatoComercial).toBe('concedido');
    expect(aceito.body.dados.lgpd.baseLegal).toBe('legitimo_interesse');
    const prova = aceito.body.dados.lgpd.consentimentos[0];
    expect(prova.finalidade).toBe('contato_comercial');
    expect(prova.canal).toBe('autocadastro');
    expect(prova.versaoTermo).toBe('[A PREENCHER, D1]');
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

  it('pede captcha não configurado a partir da quarta tentativa do mesmo IP', async () => {
    const qr = await request(app.getHttpServer())
      .post('/v1/qr')
      .set(cabecalho('vendedor', VENDEDOR));
    const token = qr.body.dados.token as string;
    for (let i = 0; i < 3; i += 1) {
      const ok = await request(app.getHttpServer())
        .post('/v1/publico/autocadastro')
        .send({ token, nome: `Pessoa ${i}`, contatoComercial: true });
      expect(ok.status).toBe(201);
    }
    const parado = await request(app.getHttpServer())
      .post('/v1/publico/autocadastro')
      .send({ token, nome: 'Quarta', contatoComercial: true });
    expect(parado.status).toBe(429);
    expect(parado.body.erros[0].codigo).toBe('CAPTCHA_NAO_CONFIGURADO');
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
    const revogado = await request(app.getHttpServer())
      .post(`/v1/contatos/${id}/revogacao`)
      .set(cabecalho('gestor', GESTOR));
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
    const eliminado = await request(app.getHttpServer())
      .post(`/v1/contatos/${id}/eliminacao`)
      .set(cabecalho('gestor', GESTOR));
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
});

function cabecalho(papel: string, id: string): Record<string, string> {
  return {
    'x-papel-teste': papel,
    'x-usuario-id': id,
    'x-autor-nome': papel === 'gestor' ? 'Gestor Termo' : 'Vendedor Termo',
  };
}
