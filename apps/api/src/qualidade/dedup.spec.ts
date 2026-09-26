import { randomBytes } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { getConnectionToken, MongooseModule } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Types, type Connection } from 'mongoose';
import request from 'supertest';
import { AuthModule } from '../auth/auth.module';
import { ContatosModule } from '../contatos/contatos.module';
import { garantirIndices } from '../contatos/schemas/registrar-modelos';
import type { UsuarioSessao } from '../contatos/sessao.middleware';
import { prazoExpirado, PRAZO_RECUPERACAO_MS } from './campos-merge';
import { compararContatos } from './comparar-contatos';
import { MergeService } from './merge.service';
import { QualidadeModule } from './qualidade.module';

const GESTOR = new Types.ObjectId().toHexString();
const MATRIZ = '11222333000181';
const FILIAL = '11222333000262';

describe('dedup e merge', () => {
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
        QualidadeModule,
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

  it('trata matriz e filial como relacionadas mesmo com o mesmo e-mail', async () => {
    const nominal = compararContatos(
      {
        nome: 'Rede',
        emails: [{ valor: 'rede@exemplo.com' }],
        pj: { cnpjHash: 'a', cnpjRaiz: '11222333', cnpjMascarado: '**.222.333/0001-**' },
      },
      {
        nome: 'Rede',
        emails: [{ valor: 'rede@exemplo.com' }],
        pj: { cnpjHash: 'b', cnpjRaiz: '11222333', cnpjMascarado: '**.222.333/0002-**' },
      },
    );
    expect(nominal?.duplicata).toBeUndefined();
    expect(nominal?.relacionado).toBe('filial');

    await criar({
      nome: 'Rede Hospital',
      email: 'rede@exemplo.com',
      telefone: '11988887777',
      cnpj: MATRIZ,
      cidade: 'São Paulo',
    });
    const filial = await criar({
      nome: 'Rede Hospital',
      email: 'rede@exemplo.com',
      telefone: '11988887777',
      cnpj: FILIAL,
      cidade: 'São Paulo',
    });
    const lista = await request(app.getHttpServer()).get('/v1/duplicatas').set(cabecalho());
    expect(lista.status).toBe(200);
    const texto = JSON.stringify(lista.body.dados);
    expect(texto).not.toContain(filial);
    const um = await request(app.getHttpServer())
      .get(`/v1/contatos/${filial}/duplicatas`)
      .set(cabecalho());
    expect(um.body.dados.duplicataSuspeita).toEqual([]);
    expect(um.body.dados.relacionados).toEqual(
      expect.arrayContaining([expect.objectContaining({ tipo: 'matriz' })]),
    );
  });

  it('sugere duplicata por e-mail e não funde sem confirmação nem sem step-up', async () => {
    const a = await criar({
      nome: 'Vencedor',
      email: 'igual@exemplo.com',
      telefone: '11911112222',
    });
    const b = await criar({
      nome: 'Absorvido',
      email: 'igual@exemplo.com',
      telefone: '11933334444',
    });
    const lista = await request(app.getHttpServer()).get('/v1/duplicatas').set(cabecalho());
    expect(JSON.stringify(lista.body.dados)).toContain('email');
    const semConfirmacao = await request(app.getHttpServer())
      .post(`/v1/contatos/${a}/merge`)
      .set(cabecalho(true))
      .send({ absorvidoId: b, confirmacao: false, valoresEscolhidos: { nome: 'absorvido' } });
    expect(semConfirmacao.status).toBe(422);
    expect(JSON.stringify(semConfirmacao.body)).toContain('MERGE_SEM_CONFIRMACAO');
    const semPasso = await request(app.getHttpServer())
      .post(`/v1/contatos/${a}/merge`)
      .set(cabecalho())
      .send({ absorvidoId: b, confirmacao: true, valoresEscolhidos: { nome: 'absorvido' } });
    expect(semPasso.status).toBe(403);
    expect(JSON.stringify(semPasso.body)).toContain('STEP_UP_NECESSARIO');
    const ainda = await request(app.getHttpServer()).get(`/v1/contatos/${b}`).set(cabecalho());
    expect(ainda.body.dados.status).not.toBe('descartado');
    expect(ainda.body.dados.nome).toBe('Absorvido');
  });

  it('funde só com decisão humana, audita o valor e recupera dentro de 90 dias', async () => {
    const a = await criar({ nome: 'Casa A', email: 'casa-a@exemplo.com', telefone: '11922223333' });
    const b = await criar({ nome: 'Casa B', email: 'casa-b@exemplo.com', telefone: '11944445555' });
    const fusao = await request(app.getHttpServer())
      .post(`/v1/contatos/${a}/merge`)
      .set(cabecalho(true))
      .send({ absorvidoId: b, confirmacao: true, valoresEscolhidos: { nome: 'absorvido' } });
    expect(fusao.status).toBe(200);
    expect(fusao.body.dados.nome).toBe('Casa B');
    const absorvido = await request(app.getHttpServer()).get(`/v1/contatos/${b}`).set(cabecalho());
    expect(absorvido.body.dados.status).toBe('descartado');
    expect(String(absorvido.body.dados.fundidoEm)).toBe(a);
    const trilha = await request(app.getHttpServer())
      .get(`/v1/contatos/${b}/auditoria`)
      .set(cabecalho());
    const status = trilha.body.dados.find((linha: { campo: string }) => linha.campo === 'status');
    expect(status.valorAnterior).toBe('capturado');
    expect(status.valorNovo).toBe('descartado');
    const nome = await request(app.getHttpServer())
      .get(`/v1/contatos/${a}/auditoria`)
      .set(cabecalho());
    const linhaNome = nome.body.dados.find((linha: { campo: string }) => linha.campo === 'nome');
    expect(linhaNome.valorAnterior).toBe('Casa A');
    expect(linhaNome.valorNovo).toBe('Casa B');
    const volta = await request(app.getHttpServer())
      .post(`/v1/contatos/${b}/recuperar`)
      .set(cabecalho(true));
    expect(volta.status).toBe(200);
    expect(volta.body.dados.status).toBe('capturado');
    const deNovo = await request(app.getHttpServer())
      .post(`/v1/contatos/${a}/merge`)
      .set(cabecalho(true))
      .send({ absorvidoId: b, confirmacao: true, valoresEscolhidos: {} });
    expect(deNovo.status).toBe(200);
    const agora = new Date();
    await expect(
      app
        .get(MergeService)
        .recuperar(b, gestor(), new Date(agora.getTime() + PRAZO_RECUPERACAO_MS + 1)),
    ).rejects.toMatchObject({ codigo: 'PRAZO_RECUPERACAO_EXPIRADO' });
    const parado = await request(app.getHttpServer()).get(`/v1/contatos/${b}`).set(cabecalho());
    expect(parado.body.dados.status).toBe('descartado');
  });

  it('marca o limite de 90 dias no instante exato', () => {
    const quando = new Date('2026-01-01T00:00:00.000Z');
    expect(prazoExpirado(quando, new Date(quando.getTime() + PRAZO_RECUPERACAO_MS))).toBe(false);
    expect(prazoExpirado(quando, new Date(quando.getTime() + PRAZO_RECUPERACAO_MS + 1))).toBe(true);
  });

  it('nega a fila ao vendedor', async () => {
    const resposta = await request(app.getHttpServer())
      .get('/v1/duplicatas')
      .set(cabecalho(false, 'vendedor'));
    expect(resposta.status).toBe(403);
  });

  async function criar(corpo: Record<string, string>): Promise<string> {
    const resposta = await request(app.getHttpServer())
      .post('/v1/contatos')
      .set(cabecalho())
      .send(corpo);
    expect(resposta.status).toBe(201);
    return resposta.body.dados._id as string;
  }
});

function gestor(): UsuarioSessao {
  return { id: GESTOR, papel: 'gestor', nome: 'Gestor do teste', stepUp: true };
}

function cabecalho(passo = false, papel = 'gestor', id = GESTOR): Record<string, string> {
  return {
    'x-papel-teste': papel,
    'x-usuario-id': id,
    'x-autor-nome': 'Gestor do teste',
    ...(passo ? { 'x-step-up-teste': '1' } : {}),
  };
}
