import { randomBytes } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { Model } from 'mongoose';
import request from 'supertest';
import { ContatosModule } from '../contatos/contatos.module';
import { AuthModule } from './auth.module';
import { AuthService } from './auth.service';
import { codigoNoPasso, passoAtual } from './totp-rfc6238';

describe('gestão de usuários', () => {
  let app: INestApplication;
  let memoria: MongoMemoryServer;
  let token = '';
  let segredoAdmin = '';

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
    await app.get(AuthService).criarUsuario('erico', 'senha-bem-longa', 'Erico', 'admin');
    const entrada = await request(app.getHttpServer())
      .post('/v1/auth/entrar')
      .send({ login: 'erico', senha: 'senha-bem-longa' });
    token = entrada.body.dados.token as string;
  });

  afterAll(async () => {
    await app.close();
    await memoria.stop();
  });

  it('cria, recusa papel e login repetido, muda perfil com TOTP e desativa', async () => {
    const preso = await request(app.getHttpServer())
      .post('/v1/usuarios')
      .set(auth())
      .send({ login: 'ana', senha: 'senha-bem-longa', nome: 'Ana', papel: 'vendedor' });
    expect(preso.status).toBe(403);
    expect(JSON.stringify(preso.body)).toContain('TOTP_NAO_INSCRITO');
    const inscricao = await request(app.getHttpServer())
      .post('/v1/auth/totp/inscrever')
      .set(auth())
      .send({});
    expect(inscricao.status).toBe(201);
    expect(inscricao.body.dados.pendente).toBe(true);
    const segredo = inscricao.body.dados.segredoBase32 as string;
    segredoAdmin = segredo;
    const ainda = await request(app.getHttpServer())
      .post('/v1/usuarios')
      .set(auth())
      .send({ login: 'ana', senha: 'senha-bem-longa', nome: 'Ana', papel: 'vendedor' });
    expect(ainda.status).toBe(403);
    const ativado = await request(app.getHttpServer())
      .post('/v1/auth/totp/ativar')
      .set(auth())
      .send({ codigoTotp: codigoNoPasso(segredo, passoAtual() - 1) });
    expect(ativado.status).toBe(200);
    const codigo = codigoNoPasso(segredo, passoAtual());

    const criado = await request(app.getHttpServer())
      .post('/v1/usuarios')
      .set(auth())
      .send({ login: 'ana', senha: 'senha-bem-longa', nome: 'Ana', papel: 'vendedor' });
    expect(criado.status).toBe(201);
    expect(criado.body.dados.papel).toBe('vendedor');
    const id = criado.body.dados.id as string;

    const papelRuim = await request(app.getHttpServer())
      .post('/v1/usuarios')
      .set(auth())
      .send({ login: 'outro', senha: 'senha-bem-longa', nome: 'Outro', papel: 'chefe' });
    expect(papelRuim.status).toBe(422);
    expect(JSON.stringify(papelRuim.body)).toContain('PAPEL_INVALIDO');

    const repetido = await request(app.getHttpServer())
      .post('/v1/usuarios')
      .set(auth())
      .send({ login: 'ana', senha: 'outra-senha-longa', nome: 'Ana 2', papel: 'gestor' });
    expect(repetido.status).toBe(422);
    expect(JSON.stringify(repetido.body)).toContain('LOGIN_EXISTENTE');

    const semPasso = await request(app.getHttpServer())
      .patch(`/v1/usuarios/${id}`)
      .set(auth())
      .send({ papel: 'gestor' });
    expect(semPasso.status).toBe(403);
    expect(JSON.stringify(semPasso.body)).toContain('STEP_UP_NECESSARIO');

    const passo = await request(app.getHttpServer())
      .post('/v1/auth/step-up')
      .set(auth())
      .send({ codigoTotp: codigo });
    expect(passo.status).toBe(201);

    const perfil = await request(app.getHttpServer())
      .patch(`/v1/usuarios/${id}`)
      .set(auth())
      .send({ papel: 'auditor' });
    expect(perfil.status).toBe(200);
    expect(perfil.body.dados.papel).toBe('auditor');

    const zerado = await request(app.getHttpServer())
      .post(`/v1/usuarios/${id}/totp/zerar`)
      .set(auth())
      .send({});
    expect(zerado.status).toBe(201);
    expect(zerado.body.dados.totp).toBe('zerado');

    const off = await request(app.getHttpServer())
      .patch(`/v1/usuarios/${id}`)
      .set(auth())
      .send({ ativo: false });
    expect(off.status).toBe(200);
    const login = await request(app.getHttpServer())
      .post('/v1/auth/entrar')
      .send({ login: 'ana', senha: 'senha-bem-longa' });
    expect(login.status).toBe(401);
  });

  it('gera senha provisória, entrega o autenticador de admin e obriga a troca', async () => {
    const servidor = app.getHttpServer();
    // Garante o passo extra do admin desta suíte com um código ainda não usado.
    await request(servidor)
      .post('/v1/auth/step-up')
      .set(auth())
      .send({ codigoTotp: codigoNoPasso(segredoAdmin, passoAtual() + 1) });

    const vendedor = await request(servidor)
      .post('/v1/usuarios')
      .set(auth())
      .send({ login: 'caio', nome: 'Caio', papel: 'vendedor' });
    expect(vendedor.status).toBe(201);
    expect(vendedor.body.dados.senhaGerada).toBe(true);
    expect(vendedor.body.dados.senhaProvisoria).toMatch(/^[A-Za-z2-9]{4}(-[A-Za-z2-9]{4}){3}$/);
    expect(vendedor.body.dados.totp).toBeNull();
    expect(vendedor.body.dados.trocarSenhaObrigatoria).toBe(true);
    const idCaio = vendedor.body.dados.id as string;
    const senhaCaio = vendedor.body.dados.senhaProvisoria as string;

    const curta = await request(servidor)
      .post('/v1/usuarios')
      .set(auth())
      .send({ login: 'curta', senha: 'curta', nome: 'Curta', papel: 'vendedor' });
    expect(curta.status).toBe(422);

    const admin = await request(servidor)
      .post('/v1/usuarios')
      .set(auth())
      .send({ login: 'bia', nome: 'Bia', papel: 'admin' });
    expect(admin.status).toBe(201);
    const segredoBia = admin.body.dados.totp.segredoBase32 as string;
    expect(admin.body.dados.totp.otpauth).toBe(
      `otpauth://totp/TattooArt:bia?secret=${segredoBia}&issuer=TattooArt&digits=6&period=30`,
    );
    const idBia = admin.body.dados.id as string;
    const senhaBia = admin.body.dados.senhaProvisoria as string;
    const lista = await request(servidor).get('/v1/usuarios').set(auth());
    expect(JSON.stringify(lista.body)).not.toContain(segredoBia);
    expect(JSON.stringify(lista.body)).not.toContain(senhaBia);

    const semCodigo = await request(servidor)
      .post('/v1/auth/entrar')
      .send({ login: 'bia', senha: senhaBia });
    expect(semCodigo.status).toBe(403);
    expect(JSON.stringify(semCodigo.body)).toContain('TOTP_OBRIGATORIO');
    const entradaBia = await request(servidor)
      .post('/v1/auth/entrar')
      .send({ login: 'bia', senha: senhaBia, codigoTotp: codigoNoPasso(segredoBia, passoAtual()) });
    expect(entradaBia.status).toBe(201);
    expect(entradaBia.body.dados.trocarSenhaObrigatoria).toBe(true);
    expect(entradaBia.body.dados.precisaInscreverTotp).toBe(false);
    const tokenBia = { authorization: `Bearer ${entradaBia.body.dados.token as string}` };
    const presa = await request(servidor).get('/v1/usuarios').set(tokenBia);
    expect(presa.status).toBe(403);
    expect(JSON.stringify(presa.body)).toContain('SENHA_PROVISORIA');
    expect((await request(servidor).get('/v1/auth/eu').set(tokenBia)).status).toBe(200);
    const repetida = await request(servidor)
      .post('/v1/auth/senha')
      .set(tokenBia)
      .send({ senhaAtual: senhaBia, senhaNova: senhaBia });
    expect(repetida.status).toBe(422);
    expect(JSON.stringify(repetida.body)).toContain('SENHA_REPETIDA');
    const trocada = await request(servidor)
      .post('/v1/auth/senha')
      .set(tokenBia)
      .send({ senhaAtual: senhaBia, senhaNova: 'nova-senha-da-bia' });
    expect(trocada.status).toBe(200);
    expect((await request(servidor).get('/v1/usuarios').set(tokenBia)).status).toBe(200);

    const entradaCaio = await request(servidor)
      .post('/v1/auth/entrar')
      .send({ login: 'caio', senha: senhaCaio });
    expect(entradaCaio.body.dados.trocarSenhaObrigatoria).toBe(true);
    const tokenCaio = { authorization: `Bearer ${entradaCaio.body.dados.token as string}` };
    const nova = await request(servidor).post(`/v1/usuarios/${idCaio}/senha/gerar`).set(auth());
    expect(nova.status).toBe(201);
    const senhaNovaCaio = nova.body.dados.senhaProvisoria as string;
    expect(senhaNovaCaio).not.toBe(senhaCaio);
    expect(nova.body.dados.sessoesEncerradas).toBe(1);
    expect((await request(servidor).get('/v1/auth/eu').set(tokenCaio)).status).not.toBe(200);
    const antiga = await request(servidor)
      .post('/v1/auth/entrar')
      .send({ login: 'caio', senha: senhaCaio });
    expect(antiga.status).toBe(401);
    const denovo = await request(servidor)
      .post('/v1/auth/entrar')
      .send({ login: 'caio', senha: senhaNovaCaio });
    expect(denovo.body.dados.trocarSenhaObrigatoria).toBe(true);

    const soAdmin = await request(servidor)
      .post(`/v1/usuarios/${idCaio}/totp/regenerar`)
      .set(auth());
    expect(soAdmin.status).toBe(422);
    expect(JSON.stringify(soAdmin.body)).toContain('TOTP_SO_ADMIN');
    const regenerado = await request(servidor)
      .post(`/v1/usuarios/${idBia}/totp/regenerar`)
      .set(auth());
    expect(regenerado.status).toBe(201);
    const segredoNovo = regenerado.body.dados.totp.segredoBase32 as string;
    expect(segredoNovo).not.toBe(segredoBia);
    expect((await request(servidor).get('/v1/auth/eu').set(tokenBia)).status).not.toBe(200);
    const codigoVelho = await request(servidor)
      .post('/v1/auth/entrar')
      .send({
        login: 'bia',
        senha: 'nova-senha-da-bia',
        codigoTotp: codigoNoPasso(segredoBia, passoAtual() + 1),
      });
    expect(codigoVelho.status).toBe(403);
    const codigoNovo = await request(servidor)
      .post('/v1/auth/entrar')
      .send({
        login: 'bia',
        senha: 'nova-senha-da-bia',
        codigoTotp: codigoNoPasso(segredoNovo, passoAtual()),
      });
    expect(codigoNovo.status).toBe(201);

    const eu = await request(servidor).get('/v1/auth/eu').set(auth());
    const propria = await request(servidor)
      .post(`/v1/usuarios/${eu.body.dados.id as string}/senha/gerar`)
      .set(auth());
    expect(propria.status).toBe(422);
    expect(JSON.stringify(propria.body)).toContain('CONTA_PROPRIA');

    const entradaVendedor = await request(servidor)
      .post('/v1/auth/entrar')
      .send({ login: 'caio', senha: senhaNovaCaio });
    const semPapel = await request(servidor)
      .post(`/v1/usuarios/${idBia}/senha/gerar`)
      .set({ authorization: `Bearer ${entradaVendedor.body.dados.token as string}` });
    expect(semPapel.status).toBe(403);

    const eventos = await app
      .get<Model<{ evento: string; usuarioId: string; porUsuarioId?: string }>>(
        getModelToken('AuthAuditoria'),
      )
      .find({ evento: { $in: ['usuario_criado', 'senha_gerada_admin', 'totp_regenerado_admin'] } })
      .lean();
    expect(eventos.map((item) => item.evento)).toEqual(
      expect.arrayContaining(['usuario_criado', 'senha_gerada_admin', 'totp_regenerado_admin']),
    );
    expect(eventos.every((item) => item.porUsuarioId === eu.body.dados.id)).toBe(true);
  });

  function auth(): Record<string, string> {
    return { authorization: `Bearer ${token}` };
  }
});
