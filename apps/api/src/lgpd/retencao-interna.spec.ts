import { INestApplication } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PapelGuard } from '../auth/papel.guard';
import { FiltroErros } from '../contatos/filtro-erros';
import { ExpurgoService } from './expurgo.service';
import { RetencaoInternaController } from './retencao-interna.controller';
import { tokenConfere } from './token-retencao';

describe('token de retenção', () => {
  const certo = 'a'.repeat(32);

  it('confere o token e recusa valor ausente, curto ou diferente', () => {
    expect(tokenConfere(certo, certo)).toBe(true);
    expect(tokenConfere(`${certo}x`, certo)).toBe(false);
    expect(tokenConfere('b'.repeat(32), certo)).toBe(false);
    expect(tokenConfere('curto', 'curto')).toBe(false);
    expect(tokenConfere(undefined, certo)).toBe(false);
    expect(tokenConfere(certo, undefined)).toBe(false);
    expect(tokenConfere('', certo)).toBe(false);
  });
});

describe('POST /v1/interno/retencao', () => {
  let app: INestApplication;
  const rodar = jest.fn(async () => ({
    inatividade: 1,
    revogacao: 0,
    rascunhos: 0,
    removidos: 0,
  }));
  const token = 't'.repeat(32);

  beforeAll(async () => {
    process.env.RETENCAO_TOKEN = token;
    const modulo = await Test.createTestingModule({
      controllers: [RetencaoInternaController],
      providers: [
        { provide: ExpurgoService, useValue: { rodar } },
        PapelGuard,
        { provide: APP_GUARD, useClass: PapelGuard },
        { provide: APP_FILTER, useClass: FiltroErros },
      ],
    }).compile();
    app = modulo.createNestApplication();
    await app.init();
  });

  afterEach(() => {
    rodar.mockClear();
  });

  afterAll(async () => {
    delete process.env.RETENCAO_TOKEN;
    await app.close();
  });

  it('recusa token ausente ou errado e não apaga', async () => {
    const semToken = await request(app.getHttpServer()).post('/v1/interno/retencao');
    expect(semToken.status).toBe(401);
    expect(semToken.body.erros[0].codigo).toBe('RETENCAO_NAO_AUTORIZADA');
    const errado = await request(app.getHttpServer())
      .post('/v1/interno/retencao')
      .set('X-Retencao-Token', 'e'.repeat(32))
      .set('Authorization', 'Bearer sessao-de-usuario');
    expect(errado.status).toBe(401);
    expect(JSON.stringify(errado.body)).not.toContain('e'.repeat(32));
    expect(rodar).not.toHaveBeenCalled();
  });

  it('com o token certo chama o expurgo', async () => {
    const resposta = await request(app.getHttpServer())
      .post('/v1/interno/retencao')
      .set('X-Retencao-Token', token);
    expect(resposta.status).toBe(200);
    expect(resposta.body.dados.inatividade).toBe(1);
    expect(resposta.body.erros).toEqual([]);
    expect(rodar).toHaveBeenCalledTimes(1);
  });
});
