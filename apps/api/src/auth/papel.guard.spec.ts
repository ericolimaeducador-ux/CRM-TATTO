import { Controller, Get, type INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthModule } from './auth.module';
import { ExigeStepUp, Papel, SemTotp } from './papeis.decorator';
import { PapelGuard } from './papel.guard';
import { PERFIL_PERMISSOES, podeAcessarCarteira, podeEscrever } from './perfil-permissoes';

@Controller('sonda')
class ControladorSemPapel {
  @Get()
  ping(): { ok: true } {
    return { ok: true };
  }
}

@Controller('venda')
class ControladorComPapel {
  @Get()
  @Papel(...PERFIL_PERMISSOES.editar_contato)
  ping(): { ok: true } {
    return { ok: true };
  }
}

@Controller('conta')
class ControladorSemTotp {
  @Get()
  @Papel('admin')
  @SemTotp()
  ping(): { ok: true } {
    return { ok: true };
  }
}

@Controller('exporta')
class ControladorStepUp {
  @Get()
  @Papel(...PERFIL_PERMISSOES.exportar)
  @ExigeStepUp()
  ping(): { ok: true } {
    return { ok: true };
  }
}

describe('PapelGuard', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      controllers: [
        ControladorSemPapel,
        ControladorComPapel,
        ControladorStepUp,
        ControladorSemTotp,
      ],
      providers: [{ provide: APP_GUARD, useClass: PapelGuard }],
    }).compile();
    app = modulo.createNestApplication();
    app.use(
      (
        req: {
          header: (nome: string) => string | undefined;
          usuario?: { papel?: string; stepUp?: boolean; totpPendente?: boolean };
        },
        _res: unknown,
        next: () => void,
      ) => {
        const papel = req.header('x-papel-teste');
        req.usuario = {
          papel,
          stepUp: req.header('x-step-up-teste') === '1',
          totpPendente: req.header('x-totp-pendente') === '1',
        };
        next();
      },
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('nega rota sem decorator mesmo para admin', async () => {
    const resposta = await request(app.getHttpServer()).get('/sonda').set('x-papel-teste', 'admin');
    expect(resposta.status).toBe(403);
    expect(JSON.stringify(resposta.body)).toContain('PAPEL_INSUFICIENTE');
  });

  it('nega auditor escrevendo e aceita vendedor', async () => {
    const auditor = await request(app.getHttpServer())
      .get('/venda')
      .set('x-papel-teste', 'auditor');
    expect(auditor.status).toBe(403);
    const vendedor = await request(app.getHttpServer())
      .get('/venda')
      .set('x-papel-teste', 'vendedor');
    expect(vendedor.status).toBe(200);
  });

  it('exige step-up na exportação', async () => {
    const sem = await request(app.getHttpServer()).get('/exporta').set('x-papel-teste', 'gestor');
    expect(sem.status).toBe(403);
    expect(JSON.stringify(sem.body)).toContain('STEP_UP_NECESSARIO');
    const com = await request(app.getHttpServer())
      .get('/exporta')
      .set('x-papel-teste', 'gestor')
      .set('x-step-up-teste', '1');
    expect(com.status).toBe(200);
  });

  it('segura o admin sem autenticador e libera a rota marcada', async () => {
    const preso = await request(app.getHttpServer())
      .get('/venda')
      .set('x-papel-teste', 'admin')
      .set('x-totp-pendente', '1');
    expect(preso.status).toBe(403);
    expect(JSON.stringify(preso.body)).toContain('TOTP_NAO_INSCRITO');
    const livre = await request(app.getHttpServer())
      .get('/conta')
      .set('x-papel-teste', 'admin')
      .set('x-totp-pendente', '1');
    expect(livre.status).toBe(200);
  });

  it('registra o guard como APP_GUARD no AuthModule', () => {
    const providers = Reflect.getMetadata('providers', AuthModule) as {
      provide?: unknown;
      useClass?: unknown;
    }[];
    expect(providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provide: APP_GUARD, useClass: PapelGuard }),
      ]),
    );
  });
});

describe('carteira', () => {
  it('vendedor só vê a própria carteira e auditor não escreve', () => {
    expect(podeAcessarCarteira('vendedor', 'u1', 'u1', 'ler_contato')).toBe(true);
    expect(podeAcessarCarteira('vendedor', 'u1', 'u2', 'editar_contato')).toBe(false);
    expect(podeAcessarCarteira('auditor', 'u9', 'u1', 'ler_contato')).toBe(true);
    expect(podeEscrever('auditor')).toBe(false);
    expect(podeAcessarCarteira('auditor', 'u9', 'u1', 'editar_contato')).toBe(false);
  });
});
