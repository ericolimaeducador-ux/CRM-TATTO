import { randomBytes } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { getConnectionToken, getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Types, type Connection, type Model } from 'mongoose';
import request from 'supertest';
import { AuthModule } from '../auth/auth.module';
import { ContatosModule } from '../contatos/contatos.module';
import { garantirIndices } from '../contatos/schemas/registrar-modelos';
import { ExportacaoModule } from './exportacao.module';

const ADMIN = new Types.ObjectId().toHexString();
const GESTOR = new Types.ObjectId().toHexString();
const VENDEDOR = new Types.ObjectId().toHexString();

describe('exportação do administrador', () => {
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
        ExportacaoModule,
      ],
    }).compile();
    app = modulo.createNestApplication();
    await app.init();
    await garantirIndices(app.get<Connection>(getConnectionToken()));
    await request(app.getHttpServer())
      .post('/v1/contatos')
      .set(cabecalho('vendedor', VENDEDOR))
      .send({ nome: 'Lead Exportado', email: 'lead@exemplo.com' });
  });

  afterAll(async () => {
    await app.close();
    await memoria.stop();
  });

  it('nega gestor e entrega csv ao admin com trilha', async () => {
    const gestor = await request(app.getHttpServer())
      .get('/v1/exportacoes?formato=csv')
      .set(cabecalho('gestor', GESTOR, true));
    expect(gestor.status).toBe(403);
    const semPasso = await request(app.getHttpServer())
      .get('/v1/exportacoes?formato=csv')
      .set(cabecalho('admin', ADMIN));
    expect(semPasso.status).toBe(403);
    expect(JSON.stringify(semPasso.body)).toContain('STEP_UP_NECESSARIO');
    const Contato = app.get<Model<{ nome?: string }>>(getModelToken('Contato'));
    await Contato.updateOne(
      { nome: 'Lead Exportado' },
      { $set: { 'lgpd.contatoComercial': 'concedido' } },
    );
    await request(app.getHttpServer())
      .post('/v1/contatos')
      .set(cabecalho('vendedor', VENDEDOR))
      .send({ nome: 'Lead Revogado', email: 'revogado@exemplo.com' });
    await request(app.getHttpServer())
      .post('/v1/contatos')
      .set(cabecalho('vendedor', VENDEDOR))
      .send({ nome: 'Lead Pendente', email: 'pendente@exemplo.com' });
    await request(app.getHttpServer())
      .post('/v1/contatos')
      .set(cabecalho('vendedor', VENDEDOR))
      .send({ nome: 'Lead Eliminado', email: 'eliminado@exemplo.com' });
    await Contato.updateOne(
      { nome: 'Lead Revogado' },
      { $set: { 'lgpd.contatoComercial': 'revogado', 'lgpd.revogadoEm': new Date() } },
    );
    await Contato.updateOne(
      { nome: 'Lead Eliminado' },
      { $set: { 'lgpd.contatoComercial': 'concedido', 'lgpd.eliminadoEm': new Date() } },
    );
    const csv = await request(app.getHttpServer())
      .get('/v1/exportacoes?formato=csv&origem=manual')
      .set(cabecalho('admin', ADMIN, true));
    expect(csv.status).toBe(200);
    expect(csv.text).toContain('Lead Exportado');
    expect(csv.text).not.toContain('Lead Revogado');
    expect(csv.text).not.toContain('Lead Pendente');
    expect(csv.text).not.toContain('Lead Eliminado');
    expect(csv.text).not.toContain('senha');
    const trilha = app.get<Model<{ autorId: string; quantidade: number }>>(
      getModelToken('ExportacaoAuditoria'),
    );
    const linha = await trilha.findOne({ autorId: ADMIN }).lean();
    expect(linha?.quantidade).toBeGreaterThan(0);
    const xlsx = await request(app.getHttpServer())
      .get('/v1/exportacoes?formato=xlsx')
      .set(cabecalho('admin', ADMIN, true))
      .buffer(true)
      .parse((res, callback) => {
        const pedacos: Buffer[] = [];
        res.on('data', (parte: Buffer) => pedacos.push(parte));
        res.on('end', () => callback(null, Buffer.concat(pedacos)));
      });
    expect(xlsx.status).toBe(200);
    expect(Buffer.isBuffer(xlsx.body)).toBe(true);
    expect((xlsx.body as Buffer).subarray(0, 2).toString()).toBe('PK');
  });
});

function cabecalho(papel: string, id: string, passo = false): Record<string, string> {
  return {
    'x-papel-teste': papel,
    'x-usuario-id': id,
    'x-autor-nome': 'Exportador',
    ...(passo ? { 'x-step-up-teste': '1' } : {}),
  };
}
