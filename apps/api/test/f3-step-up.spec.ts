import { randomBytes } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { getConnectionToken, getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Types, type Connection, type Model } from 'mongoose';
import request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
import { codigoNoPasso, passoAtual } from '../src/auth/totp-rfc6238';
import { ContatosModule } from '../src/contatos/contatos.module';
import { decifrar } from '../src/seguranca/cifra';
import { garantirIndices } from '../src/contatos/schemas/registrar-modelos';

const GESTOR = new Types.ObjectId().toHexString();

describe('promoção com TOTP', () => {
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

  it('salva um nome sem pedir TOTP', async () => {
    const criado = await request(app.getHttpServer())
      .post('/v1/contatos')
      .set(cabecalho('vendedor'))
      .send({ nome: 'Ana' });
    expect(criado.status).toBe(201);
    expect(criado.body.dados.nome).toBe('Ana');
  });

  it('promove a cliente com código RFC 6238 e recusa o mesmo passo', async () => {
    const id = await qualificar('Cliente Real');
    const segredo = await inscrever();
    const guardado = await app
      .get<Model<{ segredoCifrado: string }>>(getModelToken('UsuarioTotp'))
      .findOne({ usuarioId: GESTOR })
      .lean();
    expect(guardado?.segredoCifrado.includes('.')).toBe(true);
    expect(guardado?.segredoCifrado).not.toBe(segredo);

    const codigo = codigoNoPasso(segredo, passoAtual());
    const promovido = await request(app.getHttpServer())
      .post(`/v1/contatos/${id}/transicao`)
      .set(cabecalho())
      .send({ para: 'cliente', codigoTotp: codigo });
    expect(promovido.status).toBe(201);
    expect(promovido.body.dados.status).toBe('cliente');

    const outro = await qualificar('Cliente Reuso');
    const reuso = await request(app.getHttpServer())
      .post(`/v1/contatos/${outro}/transicao`)
      .set(cabecalho())
      .send({ para: 'cliente', codigoTotp: codigo });
    expect(reuso.status).toBe(403);
    expect(JSON.stringify(reuso.body)).toContain('CODIGO_TOTP_REUSADO');
    const segue = await request(app.getHttpServer()).get(`/v1/contatos/${outro}`).set(cabecalho());
    expect(segue.body.dados.status).toBe('qualificado');
  });

  it('recusa código fora da janela de um passo e código errado', async () => {
    const id = await qualificar('Cliente Janela');
    const segredo = await inscrever();
    const fora = codigoNoPasso(segredo, passoAtual() - 2);
    const resposta = await request(app.getHttpServer())
      .post(`/v1/contatos/${id}/transicao`)
      .set(cabecalho())
      .send({ para: 'cliente', codigoTotp: fora });
    expect(resposta.status).toBe(403);
    expect(JSON.stringify(resposta.body)).toContain('STEP_UP_NECESSARIO');
    const errado = await request(app.getHttpServer())
      .post(`/v1/contatos/${id}/transicao`)
      .set(cabecalho())
      .send({ para: 'cliente', codigoTotp: '000000' });
    expect(errado.status).toBe(403);
    const lido = await request(app.getHttpServer()).get(`/v1/contatos/${id}`).set(cabecalho());
    expect(lido.body.dados.status).toBe('qualificado');
  });

  it('não troca o segredo inscrito sem o código atual e recusa passo já usado', async () => {
    const segredo = await inscrever();
    const sem = await request(app.getHttpServer())
      .post('/v1/auth/totp/inscrever')
      .set(cabecalho())
      .send({});
    expect(sem.status).toBe(403);
    expect(JSON.stringify(sem.body)).toContain('STEP_UP_NECESSARIO');
    expect(await segredoGuardado()).toBe(segredo);

    const errado = await request(app.getHttpServer())
      .post('/v1/auth/totp/inscrever')
      .set(cabecalho())
      .send({ codigoTotp: '000000' });
    expect(errado.status).toBe(403);
    expect(await segredoGuardado()).toBe(segredo);

    const passo = passoAtual() + 1;
    await app
      .get<Model<{ ultimoPassoAceito: number | null }>>(getModelToken('UsuarioTotp'))
      .updateOne({ usuarioId: GESTOR }, { $set: { ultimoPassoAceito: passo } });
    const reuso = await request(app.getHttpServer())
      .post('/v1/auth/totp/inscrever')
      .set(cabecalho())
      .send({ codigoTotp: codigoNoPasso(segredo, passo) });
    expect(reuso.status).toBe(403);
    expect(JSON.stringify(reuso.body)).toContain('CODIGO_TOTP_REUSADO');
    expect(await segredoGuardado()).toBe(segredo);

    await app
      .get<Model<{ ultimoPassoAceito: number | null }>>(getModelToken('UsuarioTotp'))
      .updateOne({ usuarioId: GESTOR }, { $set: { ultimoPassoAceito: null } });
    const trocado = await request(app.getHttpServer())
      .post('/v1/auth/totp/inscrever')
      .set(cabecalho())
      .send({ codigoTotp: codigoNoPasso(segredo, passoAtual()) });
    expect(trocado.status).toBe(201);
    expect(trocado.body.dados.segredoBase32).not.toBe(segredo);
    expect(await segredoGuardado()).toBe(trocado.body.dados.segredoBase32);
  });

  it('aceita o atalho de cabeçalho com NODE_ENV=test', async () => {
    const id = await qualificar('Cliente Atalho');
    const promovido = await request(app.getHttpServer())
      .post(`/v1/contatos/${id}/transicao`)
      .set({ ...cabecalho(), 'x-step-up-teste': '1' })
      .send({ para: 'cliente' });
    expect(promovido.status).toBe(201);
    expect(promovido.body.dados.status).toBe('cliente');
  });

  async function inscrever(): Promise<string> {
    const resposta = await request(app.getHttpServer())
      .post('/v1/auth/totp/inscrever')
      .set({ ...cabecalho(), 'x-step-up-teste': '1' });
    expect(resposta.status).toBe(201);
    return resposta.body.dados.segredoBase32 as string;
  }

  async function segredoGuardado(): Promise<string> {
    const doc = await app
      .get<Model<{ segredoCifrado: string }>>(getModelToken('UsuarioTotp'))
      .findOne({ usuarioId: GESTOR })
      .lean();
    return decifrar(String(doc?.segredoCifrado));
  }

  async function qualificar(nome: string): Promise<string> {
    const sufixo = nome.length;
    const criado = await request(app.getHttpServer())
      .post('/v1/contatos')
      .set(cabecalho())
      .send({
        nome,
        telefone: `1195555${String(1000 + sufixo).slice(-4)}`,
        email: `${nome.toLowerCase().replace(/\s/g, '-')}@exemplo.com`,
        cpf: cpfDoNome(nome),
        logradouro: 'Rua A',
        numero: '10',
        cidade: 'São Paulo',
        uf: 'SP',
      });
    expect(criado.status).toBe(201);
    const id = criado.body.dados._id as string;
    const qualificado = await request(app.getHttpServer())
      .post(`/v1/contatos/${id}/transicao`)
      .set(cabecalho())
      .send({ para: 'qualificado' });
    expect(qualificado.status).toBe(201);
    return id;
  }
});

function cabecalho(papel = 'gestor'): Record<string, string> {
  return {
    'x-papel-teste': papel,
    'x-usuario-id': GESTOR,
    'x-autor-nome': 'Gestor do step-up',
  };
}

function cpfDoNome(nome: string): string {
  const tabela: Record<string, string> = {
    'Cliente Real': '52998224725',
    'Cliente Reuso': '39053344705',
    'Cliente Janela': '15350946056',
    'Cliente Atalho': '11144477735',
  };
  return tabela[nome] ?? '52998224725';
}
