import { randomBytes } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { getConnectionToken, getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Types, type Connection } from 'mongoose';
import request from 'supertest';
import { AuthModule } from '../auth/auth.module';
import { ContatosModule } from '../contatos/contatos.module';
import { garantirIndices } from '../contatos/schemas/registrar-modelos';
import { ClienteHttp } from './cliente-http';
import { zerarCircuitos } from './circuito';
import { IntegracoesModule } from './integracoes.module';

const VENDEDOR = new Types.ObjectId().toHexString();
const OUTRO = new Types.ObjectId().toHexString();
const CNPJ = '11222333000181';
const CNPJ_RECEITA = '11222333000343';
const CNPJ_FALHA = '11222333000424';

const BRASIL = {
  razao_social: 'CLINICA OFICIAL LTDA',
  nome_fantasia: 'CLINICA',
  email: 'oficial@exemplo.com',
  ddd_telefone_1: '1133334444',
  cep: '01310100',
  logradouro: 'AVENIDA PAULISTA',
  numero: '1000',
  bairro: 'BELA VISTA',
  municipio: 'SAO PAULO',
  uf: 'SP',
  cnae_fiscal_descricao: 'Atividades de atenção ambulatorial',
  descricao_porte: 'MICRO EMPRESA',
  descricao_situacao_cadastral: 'ATIVA',
};

const RECEITA = {
  status: 'OK',
  nome: 'CLINICA RECEITA LTDA',
  fantasia: 'RECEITA',
  email: 'receita@exemplo.com',
  telefone: '1122223333',
  cep: '01310100',
  logradouro: 'AV PAULISTA',
  numero: '50',
  municipio: 'SAO PAULO',
  uf: 'SP',
  atividade_principal: [{ text: 'Atividades médicas' }],
  situacao: 'ATIVA',
};

const VIA = {
  cep: '01310-100',
  logradouro: 'Avenida Paulista',
  complemento: '',
  bairro: 'Bela Vista',
  localidade: 'São Paulo',
  uf: 'SP',
};

describe('enriquecimento CNPJ e CEP', () => {
  let app: INestApplication;
  let memoria: MongoMemoryServer;
  let chamadas: string[];

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.CIFRA_CHAVE_BASE64 = randomBytes(32).toString('base64');
    process.env.CIFRA_PEPPER = randomBytes(32).toString('hex');
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
  });

  beforeEach(async () => {
    zerarCircuitos();
    chamadas = [];
    await app.get(getModelToken('CacheEnriquecimento')).deleteMany({});
    app.get(ClienteHttp).fetchImpl = async (url) => {
      chamadas.push(String(url));
      if (String(url).includes('brasilapi.com.br')) {
        return json(BRASIL);
      }
      if (String(url).includes('receitaws.com.br')) return json(RECEITA);
      return json(VIA);
    };
  });

  afterAll(async () => {
    await app.close();
    await memoria.stop();
  });

  it('preenche razão vazia com o contrato da BrasilAPI e não chama a rede de novo', async () => {
    const id = await criar({ nome: 'Lead Sem Razao' });
    const resposta = await consultarCnpj(id);
    expect(resposta.status).toBe(200);
    expect(resposta.body.erros).toEqual([]);
    expect(resposta.body.dados.pj.razaoSocial).toBe('Clinica Oficial Ltda');
    expect(resposta.body.dados.nome).toBe('Lead Sem Razao');
    expect(resposta.body.dados.origem.enriquecimentoBruto[0].fonte).toBe('brasilapi');
    expect(chamadas.some((url) => url.includes('brasilapi.com.br'))).toBe(true);
    chamadas.length = 0;
    await consultarCnpj(id);
    expect(chamadas).toEqual([]);
  });

  it('não sobrescreve razão digitada e devolve sugestão', async () => {
    const id = await criar({ nome: 'Casa', razaoSocial: 'Casa do Vendedor' });
    const resposta = await consultarCnpj(id);
    expect(resposta.status).toBe(200);
    expect(resposta.body.dados.pj.razaoSocial).toBe('Casa do Vendedor');
    expect(resposta.body.sugestoes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          campo: 'razaoSocial',
          valorDigitado: 'Casa do Vendedor',
          fonte: 'brasilapi',
        }),
      ]),
    );
  });

  it('cai para o contrato da ReceitaWS quando a BrasilAPI falha', async () => {
    app.get(ClienteHttp).fetchImpl = async (url) => {
      chamadas.push(String(url));
      if (String(url).includes('brasilapi.com.br')) throw new Error('timeout');
      return json(RECEITA);
    };
    const id = await criar({ nome: 'Fallback' });
    const resposta = await consultarCnpj(id, CNPJ_RECEITA);
    expect(resposta.status).toBe(200);
    expect(resposta.body.dados.pj.razaoSocial).toBe('Clinica Receita Ltda');
    expect(resposta.body.dados.nome).toBe('Fallback');
    expect(resposta.body.avisos.map((item: { codigo: string }) => item.codigo)).toContain(
      'FONTE_INDISPONIVEL',
    );
  });

  it('mantém o contato quando as duas fontes de CNPJ falham', async () => {
    app.get(ClienteHttp).fetchImpl = async (url) => {
      chamadas.push(String(url));
      throw new Error('timeout');
    };
    const id = await criar({ nome: 'Intacto' });
    const resposta = await consultarCnpj(id, CNPJ_FALHA);
    expect(resposta.status).toBe(200);
    expect(resposta.body.erros).toEqual([]);
    expect(resposta.body.dados.nome).toBe('Intacto');
    expect(resposta.body.dados.pj?.razaoSocial).toBeUndefined();
    expect(resposta.body.avisos.map((item: { codigo: string }) => item.codigo)).toContain(
      'FONTE_INDISPONIVEL',
    );
  });

  it('não consulta a rede quando o CNPJ é inválido', async () => {
    const id = await criar({ nome: 'Documento Ruim' });
    const resposta = await request(app.getHttpServer())
      .post('/v1/enriquecimento/cnpj')
      .set(cabecalho())
      .send({ contatoId: id, cnpj: '11222333000180' });
    expect(resposta.status).toBe(200);
    expect(resposta.body.avisos[0].codigo).toBe('CNPJ_INVALIDO');
    expect(chamadas).toEqual([]);
    expect(resposta.body.dados.nome).toBe('Documento Ruim');
  });

  it('preenche logradouro vazio e preserva o digitado', async () => {
    const vazio = await criar({ nome: 'Sem Rua', cep: '01310100' });
    const preenchido = await consultarCep(vazio, '01310100');
    expect(preenchido.status).toBe(200);
    expect(preenchido.body.dados.enderecos[0].logradouro).toBe('Avenida Paulista');
    const digitado = await criar({
      nome: 'Com Rua',
      cep: '01310100',
      logradouro: 'Rua do Vendedor',
    });
    const resposta = await consultarCep(digitado, '01310100');
    expect(resposta.body.dados.enderecos[0].logradouro).toBe('Rua do Vendedor');
    expect(resposta.body.sugestoes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ campo: 'logradouro', valorDigitado: 'Rua do Vendedor' }),
      ]),
    );
  });

  it('nega enriquecimento da carteira de outro vendedor', async () => {
    const id = await criar({ nome: 'Carteira' });
    const resposta = await request(app.getHttpServer())
      .post('/v1/enriquecimento/cnpj')
      .set(cabecalho('vendedor', OUTRO))
      .send({ contatoId: id, cnpj: CNPJ });
    expect(resposta.status).toBe(403);
    expect(JSON.stringify(resposta.body)).toContain('PAPEL_INSUFICIENTE');
  });

  async function criar(corpo: Record<string, string>): Promise<string> {
    const resposta = await request(app.getHttpServer())
      .post('/v1/contatos')
      .set(cabecalho())
      .send(corpo);
    expect(resposta.status).toBe(201);
    return resposta.body.dados._id as string;
  }

  function consultarCnpj(id: string, cnpj = CNPJ) {
    return request(app.getHttpServer())
      .post('/v1/enriquecimento/cnpj')
      .set(cabecalho())
      .send({ contatoId: id, cnpj });
  }

  function consultarCep(id: string, cep: string) {
    return request(app.getHttpServer())
      .get(`/v1/enriquecimento/cep/${cep}`)
      .query({ contatoId: id })
      .set(cabecalho());
  }
});

function json(corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function cabecalho(papel = 'vendedor', id = VENDEDOR): Record<string, string> {
  return {
    'x-papel-teste': papel,
    'x-usuario-id': id,
    'x-autor-nome': 'Vendedor do teste',
  };
}
