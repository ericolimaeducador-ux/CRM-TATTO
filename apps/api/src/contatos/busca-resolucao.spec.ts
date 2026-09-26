import { randomBytes } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { getConnectionToken, MongooseModule } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Types, type Connection } from 'mongoose';
import request from 'supertest';
import { AuthModule } from '../auth/auth.module';
import { ContatosModule } from './contatos.module';
import { garantirIndices } from './schemas/registrar-modelos';

const USUARIO = new Types.ObjectId().toHexString();
const CPF_A = '52998224725';
const CPF_B = '39053344705';

describe('busca, resolução e CPF repetido na edição', () => {
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

  it('encontra pelo nome e grava a escolha do conflito', async () => {
    const criado = await postar({ nome: 'Zelda Busca', telefone: '11970001111' });
    const id = criado.body.dados._id as string;
    const versao = criado.body.dados.versao as number;
    const lista = await request(app.getHttpServer())
      .get('/v1/contatos')
      .query({ q: 'Zelda' })
      .set(cabecalho());
    expect(lista.status).toBe(200);
    expect(JSON.stringify(lista.body.dados)).toContain('Zelda Busca');

    const ok = await request(app.getHttpServer())
      .patch(`/v1/contatos/${id}`)
      .set(cabecalho())
      .send({ campo: 'nome', valor: 'Zelda Servidor', versaoConhecida: versao });
    expect(ok.status).toBe(200);
    const conflito = await request(app.getHttpServer())
      .patch(`/v1/contatos/${id}`)
      .set(cabecalho())
      .send({ campo: 'nome', valor: 'Zelda Local', versaoConhecida: versao });
    expect(conflito.status).toBe(422);
    expect(JSON.stringify(conflito.body)).toContain('CONFLITO_VERSAO');

    const servidor = await request(app.getHttpServer())
      .post(`/v1/contatos/${id}/resolucao`)
      .set(cabecalho())
      .send({ escolha: 'servidor' });
    expect(servidor.status).toBe(201);
    const lido = await request(app.getHttpServer()).get(`/v1/contatos/${id}`).set(cabecalho());
    expect(lido.body.dados.nome).toBe('Zelda Servidor');
    expect(lido.body.dados.conflito).toBeFalsy();

    const versaoAtual = lido.body.dados.versao as number;
    await request(app.getHttpServer())
      .patch(`/v1/contatos/${id}`)
      .set(cabecalho())
      .send({ campo: 'nome', valor: 'Zelda Outra', versaoConhecida: versaoAtual });
    const deNovo = await request(app.getHttpServer())
      .patch(`/v1/contatos/${id}`)
      .set(cabecalho())
      .send({ campo: 'nome', valor: 'Ficou Local', versaoConhecida: versaoAtual });
    expect(deNovo.status).toBe(422);
    const local = await request(app.getHttpServer())
      .post(`/v1/contatos/${id}/resolucao`)
      .set(cabecalho())
      .send({ escolha: 'local' });
    expect(local.status).toBe(201);
    expect(local.body.dados.nome).toBe('Ficou Local');
  });

  it('não grava edição com CPF já usado e responde 422', async () => {
    const a = await postar({ nome: 'Dono A', telefone: '11970002222', cpf: CPF_A });
    const b = await postar({ nome: 'Dono B', telefone: '11970003333', cpf: CPF_B });
    expect(a.body.dados.status).toBe('capturado');
    expect(b.body.dados.status).toBe('capturado');
    const id = b.body.dados._id as string;
    const mascara = b.body.dados.pf.cpfMascarado as string;
    const edicao = await request(app.getHttpServer())
      .patch(`/v1/contatos/${id}`)
      .set(cabecalho())
      .send({ campo: 'cpf', valor: CPF_A, versaoConhecida: b.body.dados.versao });
    expect(edicao.status).toBe(422);
    expect(JSON.stringify(edicao.body)).toContain('CPF_DUPLICADO');
    expect(JSON.stringify(edicao.body)).toContain('não foi gravada');
    const lido = await request(app.getHttpServer()).get(`/v1/contatos/${id}`).set(cabecalho());
    expect(lido.body.dados.pf.cpfMascarado).toBe(mascara);
    expect(lido.body.dados.nome).toBe('Dono B');
  });

  async function postar(corpo: Record<string, string>) {
    const resposta = await request(app.getHttpServer())
      .post('/v1/contatos')
      .set(cabecalho())
      .send(corpo);
    expect(resposta.status).toBe(201);
    return resposta;
  }
});

function cabecalho(): Record<string, string> {
  return {
    'x-papel-teste': 'gestor',
    'x-usuario-id': USUARIO,
    'x-autor-nome': 'Gestor da busca',
  };
}
