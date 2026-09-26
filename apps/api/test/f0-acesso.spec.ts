import { Controller, Get, type INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ExigeStepUp, Papel } from '../src/auth/papeis.decorator';
import { PapelGuard } from '../src/auth/papel.guard';
import { PERFIL_PERMISSOES, podeAcessarCarteira } from '../src/auth/perfil-permissoes';

@Controller('sem-papel')
class SemPapel {
  @Get()
  ping(): { ok: true } {
    return { ok: true };
  }
}

@Controller('exportacao')
class Exportacao {
  @Get()
  @Papel(...PERFIL_PERMISSOES.exportar)
  @ExigeStepUp()
  ping(): { ok: true } {
    return { ok: true };
  }
}

describe('acesso indevido', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      controllers: [SemPapel, Exportacao],
      providers: [{ provide: APP_GUARD, useClass: PapelGuard }],
    }).compile();
    app = modulo.createNestApplication();
    app.use(
      (
        req: {
          header: (nome: string) => string | undefined;
          usuario?: { papel?: string; stepUp?: boolean };
        },
        _res: unknown,
        next: () => void,
      ) => {
        req.usuario = {
          papel: req.header('x-papel-teste'),
          stepUp: req.header('x-step-up-teste') === '1',
        };
        next();
      },
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('nega rota sem @Papel', async () => {
    const resposta = await request(app.getHttpServer())
      .get('/sem-papel')
      .set('x-papel-teste', 'admin');
    expect(resposta.status).toBe(403);
    expect(JSON.stringify(resposta.body)).toContain('PAPEL_INSUFICIENTE');
  });

  it('nega exportação sem step-up e vendedor na carteira alheia', async () => {
    const exportacao = await request(app.getHttpServer())
      .get('/exportacao')
      .set('x-papel-teste', 'gestor');
    expect(exportacao.status).toBe(403);
    expect(JSON.stringify(exportacao.body)).toContain('STEP_UP_NECESSARIO');
    expect(podeAcessarCarteira('vendedor', 'v1', 'v2', 'ler_contato')).toBe(false);
    expect(podeAcessarCarteira('auditor', 'a1', 'v2', 'editar_contato')).toBe(false);
  });
});
