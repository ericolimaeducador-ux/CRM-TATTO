import { randomBytes } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { getConnectionToken, MongooseModule } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Types, type Connection } from 'mongoose';
import request from 'supertest';
import { AuthModule } from '../auth/auth.module';
import { garantirIndices } from '../contatos/schemas/registrar-modelos';
import { ClienteHttp } from './cliente-http';
import { zerarCircuitos } from './circuito';
import { IntegracoesModule } from './integracoes.module';

const GESTOR = new Types.ObjectId().toHexString();
const RESPONSAVEL = new Types.ObjectId().toHexString();

describe('ingestão Google Sheets', () => {
  let app: INestApplication;
  let memoria: MongoMemoryServer;
  let grade: string[][];
  let chamadas: number;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.SHEETS_PLANILHA_ID;
    delete process.env.SHEETS_TOKEN;
    delete process.env.SHEETS_RESPONSAVEL_ID;
    process.env.CIFRA_CHAVE_BASE64 = randomBytes(32).toString('base64');
    process.env.CIFRA_PEPPER = randomBytes(32).toString('hex');
    memoria = await MongoMemoryServer.create();
    const modulo = await Test.createTestingModule({
      imports: [MongooseModule.forRoot(memoria.getUri()), AuthModule, IntegracoesModule],
    }).compile();
    app = modulo.createNestApplication();
    await app.init();
    await garantirIndices(app.get<Connection>(getConnectionToken()));
  });

  beforeEach(() => {
    zerarCircuitos();
    chamadas = 0;
    grade = [
      ['Nome', 'E-mail', 'Telefone', 'Cidade', 'Consentimento'],
      ['Ana Planilha', 'ana@exemplo.com', '11988887777', 'São Paulo', 'sim'],
      ['', '', '', '', ''],
      ['Bia Planilha', 'bia@exemplo.com', '11977776666', 'Campinas', 'concedido'],
    ];
    app.get(ClienteHttp).fetchImpl = async () => {
      chamadas += 1;
      return new Response(
        JSON.stringify({ range: 'Respostas!A1:D4', majorDimension: 'ROWS', values: grade }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      );
    };
  });

  afterAll(async () => {
    delete process.env.SHEETS_PLANILHA_ID;
    delete process.env.SHEETS_TOKEN;
    delete process.env.SHEETS_RESPONSAVEL_ID;
    await app.close();
    await memoria.stop();
  });

  it('não chama a rede e não trava quando a conta do dono não foi fornecida', async () => {
    delete process.env.SHEETS_PLANILHA_ID;
    delete process.env.SHEETS_TOKEN;
    delete process.env.SHEETS_RESPONSAVEL_ID;
    const resposta = await sincronizar();
    expect(resposta.status).toBe(200);
    expect(resposta.body.erros).toEqual([]);
    expect(resposta.body.avisos[0].codigo).toBe('PLANILHA_NAO_CONFIGURADA');
    expect(chamadas).toBe(0);
  });

  it('reprocessa a grade inteira sem duplicar e aceita linha inserida no meio', async () => {
    process.env.SHEETS_PLANILHA_ID = 'planilha-de-contrato';
    process.env.SHEETS_TOKEN = 'token-de-contrato';
    process.env.SHEETS_RESPONSAVEL_ID = RESPONSAVEL;
    process.env.SHEETS_ABA = 'Respostas';
    const primeira = await sincronizar();
    expect(primeira.status).toBe(200);
    expect(primeira.body.dados.importados).toBe(2);
    const repetida = await sincronizar();
    expect(repetida.body.dados.importados).toBe(0);
    grade = [
      ['Nome', 'E-mail', 'Telefone', 'Cidade', 'Consentimento'],
      ['Ana Planilha', 'ana@exemplo.com', '11988887777', 'São Paulo', 'sim'],
      ['Caio Planilha', 'caio@exemplo.com', '11966665555', 'Santos', 'sim'],
      ['', '', '', '', ''],
      ['Bia Planilha', 'bia@exemplo.com', '11977776666', 'Campinas', 'concedido'],
    ];
    const terceira = await sincronizar();
    expect(terceira.body.dados.importados).toBe(1);
    const lista = await request(app.getHttpServer()).get('/v1/contatos').set(cabecalho());
    const nomes = lista.body.dados.map((item: { nome?: string }) => item.nome).sort();
    expect(nomes).toEqual(['Ana Planilha', 'Bia Planilha', 'Caio Planilha']);
    for (const item of lista.body.dados as {
      origem?: { modo?: string };
      lgpd?: { contatoComercial?: string; baseLegal?: string; consentimentos?: unknown[] };
    }[]) {
      expect(item.origem?.modo).toBe('importado');
      expect(item.lgpd?.baseLegal).toBe('legitimo_interesse');
      expect(item.lgpd?.contatoComercial).toBe('pendente');
      expect(item.lgpd?.consentimentos ?? []).toEqual([]);
    }
    expect(chamadas).toBe(3);
  });

  it('nega a sincronização ao vendedor', async () => {
    const resposta = await request(app.getHttpServer())
      .post('/v1/integracoes/sheets/sincronizar')
      .set(cabecalho('vendedor'));
    expect(resposta.status).toBe(403);
  });

  function sincronizar() {
    return request(app.getHttpServer()).post('/v1/integracoes/sheets/sincronizar').set(cabecalho());
  }
});

function cabecalho(papel = 'gestor', id = GESTOR): Record<string, string> {
  return {
    'x-papel-teste': papel,
    'x-usuario-id': id,
    'x-autor-nome': 'Gestor do teste',
  };
}
