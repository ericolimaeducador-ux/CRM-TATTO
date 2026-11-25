import { randomBytes } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types, type Model } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { AuthModule } from '../auth/auth.module';
import { ContatosModule } from '../contatos/contatos.module';
import { ComercialModule } from './comercial.module';
import type { DocumentoComercial } from './comercial.schema';

const GESTOR = '507f1f77bcf86cd799439201';
const VENDEDOR = '507f1f77bcf86cd799439202';
const OUTRO = '507f1f77bcf86cd799439203';
const head = (papel = 'gestor', id = papel === 'vendedor' ? VENDEDOR : GESTOR) => ({
  'x-papel-teste': papel,
  'x-usuario-id': id,
  'x-autor-nome': 'QA carteira',
});

describe('ADR-028 — conta da carteira nasce do contato qualificado', () => {
  let app: INestApplication;
  let mongo: MongoMemoryServer;
  let registros: Model<DocumentoComercial>;
  const ambienteAnterior = process.env.NODE_ENV;
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.CIFRA_CHAVE_BASE64 = randomBytes(32).toString('base64');
    process.env.CIFRA_PEPPER = randomBytes(32).toString('hex');
    mongo = await MongoMemoryServer.create();
    const modulo = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongo.getUri()),
        AuthModule,
        ContatosModule,
        ComercialModule,
      ],
    }).compile();
    app = modulo.createNestApplication();
    await app.init();
    registros = app.get<Model<DocumentoComercial>>(getModelToken('Comercial'));
    await registros.syncIndexes();
    await registros.db.collection('usuarios').insertMany(
      [
        [GESTOR, 'gestor'],
        [VENDEDOR, 'vendedor'],
        [OUTRO, 'vendedor'],
      ].map(([id, papel]) => ({
        _id: new Types.ObjectId(id),
        login: `qa-${id.slice(-3)}`,
        nome: `QA ${papel}`,
        papel,
        ativo: true,
        senhaHash: 'fixture-sem-login',
        criadoEm: new Date(),
      })),
    );
  });
  beforeEach(async () => {
    await registros.deleteMany({});
    await registros.db.collection('contatos').deleteMany({});
  });
  afterAll(async () => {
    if (app) await app.close();
    if (mongo) await mongo.stop();
    process.env.NODE_ENV = ambienteAnterior;
  });
  const api = () => request(app.getHttpServer());
  const contas = () => registros.find({ tipo: 'contas' }).lean();

  async function lead(dados: Record<string, unknown> = {}) {
    const r = await api()
      .post('/v1/contatos')
      .set(head())
      .send({
        nome: 'Estúdio Agulha Fina',
        telefone: '11955554444',
        email: 'agulha@exemplo.com',
        cidade: 'Campinas',
        uf: 'SP',
        tipoPessoa: 'PJ',
        ...dados,
      });
    expect(r.status).toBe(201);
    return r.body.dados as { _id: string; versao: number };
  }
  const transicao = (id: string, para: string, motivo?: string) =>
    api().post(`/v1/contatos/${id}/transicao`).set(head()).send({ para, motivo });

  it('não cria conta para lead capturado; qualificar cria uma só, espelhando a ficha', async () => {
    const c = await lead();
    expect(await contas()).toHaveLength(0);
    expect((await transicao(c._id, 'qualificado')).status).toBe(201);
    const [conta, ...resto] = await contas();
    expect(resto).toHaveLength(0);
    expect(conta.campos).toMatchObject({
      contatoOrigemId: c._id,
      nome: 'Estúdio Agulha Fina',
      contatoEmail: 'agulha@exemplo.com',
      cidade: 'Campinas',
      uf: 'SP',
      segmento: 'estudio_tatuagem',
      status: 'prospect',
      classificacao: 'B',
    });
    expect(String(conta.campos.contatoTelefone)).toContain('5511955554444');
    expect(conta.donoId).toBe(GESTOR);
    expect(conta.auditoria[0].acao).toBe('criar_do_contato');
    expect(JSON.stringify(conta.auditoria)).not.toContain(GESTOR);
  });

  it('editar a ficha atualiza a conta sem perder campos comerciais; responsável vira dono', async () => {
    const c = await lead({ nome: 'Tatuador Solo', tipoPessoa: 'PF' });
    await transicao(c._id, 'qualificado');
    const [conta] = await contas();
    expect(conta.campos.segmento).toBe('profissional_autonomo');
    // Campo só comercial, editado na conta, sobrevive à sincronização.
    const editada = await api()
      .patch(`/v1/comercial/contas/${String(conta._id)}`)
      .set(head())
      .send({ versao: conta.versao, classificacao: 'A', proximaAcao: 'Levar amostras' });
    expect(editada.status).toBe(200);
    const lido = await api().get(`/v1/contatos/${c._id}`).set(head());
    const r = await api()
      .patch(`/v1/contatos/${c._id}`)
      .set(head())
      .send({ campo: 'cidade', valor: 'Sorocaba', versaoConhecida: lido.body.dados.versao });
    expect(r.status).toBe(200);
    let [depois] = await contas();
    expect(depois.campos).toMatchObject({
      cidade: 'Sorocaba',
      classificacao: 'A',
      proximaAcao: 'Levar amostras',
    });
    expect(depois.auditoria.at(-1)?.acao).toBe('sincronizar_contato');
    expect(depois.auditoria.at(-1)?.campos).toEqual(['cidade']);
    // Representante não vê a conta até ela ser passada para ele.
    const antes = await api().get('/v1/comercial/contas').set(head('vendedor'));
    expect(JSON.stringify(antes.body)).not.toContain('Tatuador Solo');
    expect(
      (
        await api()
          .post('/v1/contatos/atribuir')
          .set(head())
          .send({ ids: [c._id], responsavelId: VENDEDOR })
      ).status,
    ).toBeLessThan(300);
    [depois] = await contas();
    expect(depois.donoId).toBe(VENDEDOR);
    const agora = await api().get('/v1/comercial/contas').set(head('vendedor'));
    expect(JSON.stringify(agora.body)).toContain('Tatuador Solo');
  });

  it('descartar arquiva a conta e reabrir/qualificar de novo restaura a mesma', async () => {
    const c = await lead({ nome: 'Estúdio Volta' });
    await transicao(c._id, 'qualificado');
    const [conta] = await contas();
    expect((await transicao(c._id, 'descartado', 'Sem interesse agora')).status).toBe(201);
    let [depois] = await contas();
    expect(depois.arquivado).toBe(true);
    expect(depois.auditoria.at(-1)?.acao).toBe('arquivar_do_contato');
    await transicao(c._id, 'capturado');
    await transicao(c._id, 'qualificado');
    const todas = await contas();
    expect(todas).toHaveLength(1);
    [depois] = todas;
    expect(String(depois._id)).toBe(String(conta._id));
    expect(depois.arquivado).toBe(false);
  });

  describe('ADR-029 — triagem do SDR e qualificação na carteira', () => {
    const triar = (id: string, situacao: string, motivo?: string, papel = 'gestor') =>
      api().post(`/v1/contatos/${id}/triagem`).set(head(papel)).send({ situacao, motivo });

    it('interessado entra na carteira com um clique, sem cidade, UF ou tipo', async () => {
      const r = await api()
        .post('/v1/contatos')
        .set(head())
        .send({ nome: 'Só Nome e Zap', telefone: '11944443333' });
      const id = r.body.dados._id as string;
      expect((await triar(id, 'talvez')).status).toBe(422);
      const ok = await triar(id, 'interessado');
      expect(ok.status).toBe(201);
      expect(ok.body.dados.triagem.situacao).toBe('interessado');
      const [conta] = await contas();
      expect(conta.campos).toMatchObject({
        contatoOrigemId: id,
        nome: 'Só Nome e Zap',
        trilha: 'funil',
        etapaJornada: 'conversa',
      });
      const trilha = await registros.db
        .collection('contatos_auditoria')
        .findOne({ campo: 'triagem', valorNovo: 'interessado' });
      expect(trilha).toBeTruthy();
    });

    it('desinteressado arquiva a conta, guarda o motivo e volta em 6 meses', async () => {
      const c = await lead({ nome: 'Mudou de Ideia' });
      await triar(c._id, 'interessado');
      const r = await triar(c._id, 'desinteressado', 'Já usa outra marca');
      expect(r.status).toBe(201);
      expect(r.body.dados.triagem.motivo).toBe('Já usa outra marca');
      const dias =
        (Date.parse(r.body.dados.triagem.retomarEm) - Date.parse(r.body.dados.triagem.em)) /
        86_400_000;
      expect(Math.round(dias)).toBe(180);
      const [conta] = await contas();
      expect(conta.arquivado).toBe(true);
    });

    it('adormecer marca retomada em 60 dias; funil limpa; proposta exige documento e endereço', async () => {
      const c = await lead({ nome: 'Estúdio Lento' });
      await triar(c._id, 'interessado');
      let [conta] = await contas();
      const patch = (corpo: Record<string, unknown>) =>
        api()
          .patch(`/v1/comercial/contas/${String(conta._id)}`)
          .set(head())
          .send({ versao: conta.versao, ...corpo });
      const dormiu = await patch({ trilha: 'adormecido' });
      expect(dormiu.status).toBe(200);
      [conta] = await contas();
      const dias = (Date.parse(String(conta.campos.retomarEm)) - Date.now()) / 86_400_000;
      expect(Math.round(dias)).toBeGreaterThanOrEqual(59);
      expect(Math.round(dias)).toBeLessThanOrEqual(60);
      expect((await patch({ trilha: 'funil' })).status).toBe(200);
      [conta] = await contas();
      expect(conta.campos.retomarEm).toBeUndefined();
      expect((await patch({ etapaJornada: 'academia' })).status).toBe(200);
      [conta] = await contas();
      const barrado = await patch({ etapaJornada: 'proposta' });
      expect(barrado.status).toBe(422);
      expect(barrado.text).toContain('CPF ou CNPJ');
      expect(barrado.text).toContain('endereço');
      [conta] = await contas();
      expect(conta.campos.etapaJornada).toBe('academia');
    });

    it('pediu para sair bloqueia o WhatsApp de vez e a lista separa cada grupo', async () => {
      const quer = await lead({ nome: 'Quer Conhecer', telefone: '11911110001' });
      const nao = await lead({ nome: 'Agora Não', telefone: '11911110002' });
      const sair = await lead({ nome: 'Não Mande Mais', telefone: '11911110003' });
      await lead({ nome: 'Sem Resposta', telefone: '11911110004' });
      await triar(quer._id, 'interessado');
      await triar(nao._id, 'desinteressado');
      const r = await triar(sair._id, 'saiu');
      expect(r.status).toBe(201);
      expect(r.body.dados.triagem.situacao).toBe('saiu');
      expect(r.body.dados.triagem.retomarEm).toBeUndefined();
      expect(await registros.db.collection('whatsapp_bloqueios').countDocuments()).toBe(1);
      const nomes = async (triagem: string) =>
        (await api().get(`/v1/contatos?triagem=${triagem}`).set(head())).body.dados.map(
          (c: { nome: string }) => c.nome,
        );
      expect(await nomes('interessado')).toEqual(['Quer Conhecer']);
      expect(await nomes('desinteressado')).toEqual(['Agora Não']);
      expect(await nomes('saiu')).toEqual(['Não Mande Mais']);
      expect(await nomes('sem')).toEqual(['Sem Resposta']);
      const ativas = (await contas()).filter((c) => !c.arquivado);
      expect(ativas.map((c) => c.campos.nome)).toEqual(['Quer Conhecer']);
    });

    it('representante tria os próprios contatos', async () => {
      const r = await api()
        .post('/v1/contatos')
        .set(head('vendedor'))
        .send({ nome: 'Do Representante', telefone: '11933332222' });
      expect((await triar(r.body.dados._id, 'interessado', undefined, 'vendedor')).status).toBe(
        201,
      );
      const [conta] = await contas();
      expect(conta.donoId).toBe(VENDEDOR);
    });
  });
});
