import { randomBytes, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { getConnectionToken, MongooseModule } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Types, type Connection } from 'mongoose';
import request from 'supertest';
import { AuthModule } from '../auth/auth.module';
import { garantirIndices } from './schemas/registrar-modelos';
import { profundidadeFila } from '../observabilidade/fila-sincronizacao';
import { ContatosModule } from './contatos.module';

const USUARIO = new Types.ObjectId().toHexString();
const OUTRO = new Types.ObjectId().toHexString();
const CPF = '52998224725';

describe('API de contatos', () => {
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

  it('persiste só o nome, sem promover', async () => {
    const resposta = await request(app.getHttpServer())
      .post('/v1/contatos')
      .set(cabecalho())
      .send({ nome: 'Ana', idLocal: randomUUID() });
    expect(resposta.status).toBe(201);
    expect(resposta.body.dados.nome).toBe('Ana');
    expect(resposta.body.dados.status).toBe('rascunho');
    expect(resposta.body.dados.tipoPessoa).toBe('INDEFINIDO');
    expect(resposta.body.erros).toEqual([]);
  });

  it('reenvia o mesmo idLocal sem duplicar', async () => {
    const idLocal = randomUUID();
    const primeiro = await request(app.getHttpServer())
      .post('/v1/contatos')
      .set(cabecalho())
      .send({ nome: 'Bia', idLocal });
    const segundo = await request(app.getHttpServer())
      .post('/v1/contatos')
      .set(cabecalho())
      .send({ nome: 'Outra', idLocal });
    expect(segundo.status).toBe(200);
    expect(segundo.body.dados._id).toBe(primeiro.body.dados._id);
    expect(segundo.body.dados.nome).toBe('Bia');
  });

  it('aceita dois posts simultâneos do mesmo idLocal como um contato', async () => {
    const idLocal = randomUUID();
    const envios = await Promise.all([
      request(app.getHttpServer())
        .post('/v1/contatos')
        .set(cabecalho())
        .send({ nome: 'Caio', idLocal }),
      request(app.getHttpServer())
        .post('/v1/contatos')
        .set(cabecalho())
        .send({ nome: 'Caio', idLocal }),
    ]);
    expect(envios.map((item) => item.status).sort()).toEqual([200, 201]);
    const lista = await request(app.getHttpServer()).get('/v1/contatos').set(cabecalho());
    expect(
      lista.body.dados.filter((item: { idLocal?: string }) => item.idLocal === idLocal),
    ).toHaveLength(1);
  });

  it('persiste rascunho → capturado quando o score chega a 25', async () => {
    const resposta = await request(app.getHttpServer())
      .post('/v1/contatos')
      .set(cabecalho())
      .send({ nome: 'Dora', telefone: '11988887777', idLocal: randomUUID() });
    expect(resposta.status).toBe(201);
    expect(resposta.body.dados.status).toBe('capturado');
    expect(resposta.body.dados.completude.score).toBeGreaterThanOrEqual(25);
  });

  it('deixa dois rascunhos com o mesmo CPF', async () => {
    const primeiro = await request(app.getHttpServer())
      .post('/v1/contatos')
      .set(cabecalho())
      .send({ cpf: CPF });
    const segundo = await request(app.getHttpServer())
      .post('/v1/contatos')
      .set(cabecalho())
      .send({ cpf: CPF });
    expect(primeiro.status).toBe(201);
    expect(segundo.status).toBe(201);
    expect(primeiro.body.dados.status).toBe('rascunho');
    expect(segundo.body.dados.status).toBe('rascunho');
  });

  it('grava CPF malformado sem bloquear e sem devolver o texto puro', async () => {
    const resposta = await request(app.getHttpServer())
      .post('/v1/contatos')
      .set(cabecalho())
      .send({ nome: 'Eva', cpf: 'NAO-E-CPF-XYZ' });
    expect(resposta.status).toBe(201);
    expect(JSON.stringify(resposta.body)).not.toContain('NAO-E-CPF-XYZ');
    expect(JSON.stringify(resposta.body.avisos)).toContain('CPF_INVALIDO');
  });

  it('descarta autoria do cliente e audita com o autor da sessão', async () => {
    const avisos: string[] = [];
    const original = console.warn;
    console.warn = (mensagem: unknown) => {
      avisos.push(String(mensagem));
      original(mensagem);
    };
    const criado = await request(app.getHttpServer()).post('/v1/contatos').set(cabecalho()).send({
      nome: 'Gabi',
      telefone: '11977776666',
      criadoPor: new Types.ObjectId().toHexString(),
    });
    console.warn = original;
    expect(criado.body.dados.criadoPor).toBe(USUARIO);
    expect(avisos.join('\n')).toContain('tentativa_autoria_cliente');
    const patch = await request(app.getHttpServer())
      .patch(`/v1/contatos/${criado.body.dados._id}`)
      .set(cabecalho())
      .send({
        campo: 'nome',
        valor: 'gabriela souza',
        versaoConhecida: criado.body.dados.versao,
        alteradoPor: OUTRO,
      });
    expect(patch.status).toBe(200);
    expect(patch.body.dados.nome).toBe('Gabriela Souza');
    const trilha = await request(app.getHttpServer())
      .get(`/v1/contatos/${criado.body.dados._id}/auditoria`)
      .set(cabecalho('gestor'));
    const nome = trilha.body.dados.find((linha: { campo: string }) => linha.campo === 'nome');
    expect(nome.valorAnterior).toBe('Gabi');
    expect(nome.valorNovo).toBe('Gabriela Souza');
    expect(nome.autor).toBe(USUARIO);
  });

  it('não deixa duas edições da mesma versão se sobrescreverem', async () => {
    const criado = await request(app.getHttpServer())
      .post('/v1/contatos')
      .set(cabecalho())
      .send({ nome: 'Helo', telefone: '11966665555' });
    const versao = criado.body.dados.versao as number;
    const id = criado.body.dados._id as string;
    const [um, dois] = await Promise.all([
      request(app.getHttpServer())
        .patch(`/v1/contatos/${id}`)
        .set(cabecalho())
        .send({ campo: 'nome', valor: 'Helo Um', versaoConhecida: versao }),
      request(app.getHttpServer())
        .patch(`/v1/contatos/${id}`)
        .set(cabecalho())
        .send({ campo: 'nome', valor: 'Helo Dois', versaoConhecida: versao }),
    ]);
    expect([um.status, dois.status].sort()).toEqual([200, 422]);
    expect(JSON.stringify([um.body, dois.body])).toContain('CONFLITO_VERSAO');
    const lido = await request(app.getHttpServer()).get(`/v1/contatos/${id}`).set(cabecalho());
    const nomes = [um.body.dados?.nome, dois.body.dados?.nome, lido.body.dados.nome];
    expect(nomes.filter((nome) => nome === lido.body.dados.nome).length).toBeGreaterThan(0);
    expect([um.body.dados?.nome, dois.body.dados?.nome]).toContain(lido.body.dados.nome);
  });

  it('nega auditor escrevendo e vendedor na carteira alheia', async () => {
    const criado = await request(app.getHttpServer())
      .post('/v1/contatos')
      .set(cabecalho())
      .send({ nome: 'Ivo' });
    const auditor = await request(app.getHttpServer())
      .post('/v1/contatos')
      .set(cabecalho('auditor'))
      .send({ nome: 'Não' });
    expect(auditor.status).toBe(403);
    const alheio = await request(app.getHttpServer())
      .get(`/v1/contatos/${criado.body.dados._id}`)
      .set(cabecalho('vendedor', OUTRO));
    expect(alheio.status).toBe(403);
    expect(JSON.stringify(alheio.body)).toContain('PAPEL_INSUFICIENTE');
  });

  it('rejeita lote acima de 100 e registra a profundidade da fila', async () => {
    const grande = await request(app.getHttpServer())
      .post('/v1/contatos/lote')
      .set(cabecalho())
      .send({ itens: Array.from({ length: 101 }, () => ({ nome: 'Lote' })), profundidade: 4 });
    expect(grande.status).toBe(422);
    expect(JSON.stringify(grande.body)).toContain('LIMITE_LOTE_EXCEDIDO');
    expect(profundidadeFila()).toBe(4);
    const idLocal = randomUUID();
    const lote = await request(app.getHttpServer())
      .post('/v1/contatos/lote')
      .set(cabecalho())
      .send({
        itens: [
          { nome: 'Lote Um', idLocal },
          { nome: 'Lote Um', idLocal },
        ],
        profundidade: 0,
      });
    expect(lote.status).toBe(201);
    expect(lote.body.dados).toHaveLength(2);
    expect(lote.body.dados[0].dados._id).toBe(lote.body.dados[1].dados._id);
  });
});

function cabecalho(papel = 'vendedor', id = USUARIO): Record<string, string> {
  return {
    'x-papel-teste': papel,
    'x-usuario-id': id,
    'x-autor-nome': 'Vendedora da sessão',
  };
}
