import { randomBytes } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { getConnectionToken, MongooseModule } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Types, type Connection } from 'mongoose';
import request from 'supertest';
import { AuthModule } from '../auth/auth.module';
import { ContatosModule } from '../contatos/contatos.module';
import { LgpdModule } from '../lgpd/lgpd.module';
import { garantirIndices } from '../contatos/schemas/registrar-modelos';
import { paraXlsx } from '../exportacao/tabela';
import { ImportacaoModule } from './importacao.module';

const GESTOR = new Types.ObjectId().toHexString();

describe('importação de planilha', () => {
  let app: INestApplication;
  let memoria: MongoMemoryServer;

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
        LgpdModule,
        ImportacaoModule,
      ],
    }).compile();
    app = modulo.createNestApplication();
    await app.init();
    await garantirIndices(app.get<Connection>(getConnectionToken()));
  });

  afterAll(async () => {
    await app.close();
    await memoria.stop();
  });

  it('marca origem importado, deduplica e libera o uso por legítimo interesse', async () => {
    const csv = 'nome,email,telefone\nAna Importada,ana.importada@exemplo.com,11988887777\n';
    const primeira = await request(app.getHttpServer())
      .post('/v1/importacoes')
      .set(cabecalho())
      .send({ texto: csv });
    expect(primeira.status).toBe(200);
    expect(primeira.body.dados.importados).toBe(1);
    const repetida = await request(app.getHttpServer())
      .post('/v1/importacoes')
      .set(cabecalho())
      .send({ texto: csv });
    expect(repetida.body.dados.importados).toBe(0);
    expect(repetida.body.dados.duplicatas).toBe(1);
    const lista = await request(app.getHttpServer()).get('/v1/contatos').set(cabecalho());
    const ana = lista.body.dados.find(
      (item: { nome?: string }) => item.nome === 'Ana Importada',
    ) as {
      _id: string;
      origem: { modo: string };
      lgpd: { baseLegal: string; contatoComercial: string; consentimentos: unknown[] };
    };
    expect(ana.origem.modo).toBe('importado');
    expect(ana.lgpd.baseLegal).toBe('legitimo_interesse');
    expect(ana.lgpd.contatoComercial).toBe('pendente');
    expect(ana.lgpd.consentimentos).toEqual([]);
    const uso = await request(app.getHttpServer())
      .post(`/v1/contatos/${ana._id}/contato-comercial`)
      .set(cabecalho());
    expect(uso.status).toBe(201);
    const xlsx = paraXlsx([
      ['nome', 'email'],
      ['Bia Planilha', 'bia.planilha@exemplo.com'],
    ]).toString('base64');
    const arquivo = await request(app.getHttpServer())
      .post('/v1/importacoes')
      .set(cabecalho())
      .send({ xlsxBase64: xlsx });
    expect(arquivo.body.dados.importados).toBe(1);
    const vendedor = await request(app.getHttpServer())
      .post('/v1/importacoes')
      .set(cabecalho('vendedor'))
      .send({ texto: csv });
    expect(vendedor.status).toBe(403);
  });

  it('deduplica CPF e nome com empresa, e não conta nome só como novo', async () => {
    const criado = await request(app.getHttpServer())
      .post('/v1/contatos')
      .set(cabecalho())
      .send({ nome: 'Documento Importado', cpf: '52998224725', email: 'doc@exemplo.com' });
    expect(criado.status).toBe(201);
    const porCpf = await request(app.getHttpServer())
      .post('/v1/importacoes')
      .set(cabecalho())
      .send({
        texto: 'nome,cpf,email\nOutro Nome,529.982.247-25,outro.doc@exemplo.com\n',
      });
    expect(porCpf.body.dados.importados).toBe(0);
    expect(porCpf.body.dados.duplicatas).toBe(1);
    const nomes = await request(app.getHttpServer())
      .post('/v1/importacoes')
      .set(cabecalho())
      .send({ texto: 'nome,empresa\nSo Nome,\n' });
    expect(nomes.body.dados.importados).toBe(1);
    const repetido = await request(app.getHttpServer())
      .post('/v1/importacoes')
      .set(cabecalho())
      .send({ texto: 'nome\nso nome\n' });
    expect(repetido.body.dados.importados).toBe(0);
    expect(repetido.body.dados.duplicatas).toBe(1);
    const outraCasa = await request(app.getHttpServer())
      .post('/v1/importacoes')
      .set(cabecalho())
      .send({ texto: 'nome,empresa\nSo Nome,Casa Alfa\n' });
    expect(outraCasa.body.dados.importados).toBe(1);
    const mesmaCasa = await request(app.getHttpServer())
      .post('/v1/importacoes')
      .set(cabecalho())
      .send({ texto: 'nome,instituição\nso nome,casa alfa\n' });
    expect(mesmaCasa.body.dados.duplicatas).toBe(1);
    expect(mesmaCasa.body.dados.importados).toBe(0);
  });
});

function cabecalho(papel = 'gestor'): Record<string, string> {
  return {
    'x-papel-teste': papel,
    'x-usuario-id': GESTOR,
    'x-autor-nome': 'Gestor Importação',
  };
}
