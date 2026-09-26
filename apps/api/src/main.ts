import 'reflect-metadata';
import type { Express, Request, Response } from 'express';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  carregarRegistradores,
  garantirIndicesSeExistirem,
} from './composicao/carregar-registradores';
import { LogJson } from './observabilidade/log-json';
import { origemDeRedeLocal } from './lgpd/origem-cors';
import { saltosDeProxyConfiavel } from './lgpd/proxy-confiavel';
import { profundidadeFila } from './observabilidade/fila-sincronizacao';

async function bootstrap(): Promise<void> {
  carregarRegistradores();
  const app = await NestFactory.create(AppModule, { logger: new LogJson() });
  app.enableCors({
    origin: (origem, responder) => responder(null, origemDeRedeLocal(origem)),
  });
  const expressApp = app.getHttpAdapter().getInstance() as Express;
  const saltos = saltosDeProxyConfiavel();
  if (saltos !== null) expressApp.set('trust proxy', saltos);
  expressApp.get('/v1/saude', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      servico: 'captura7-api',
      filaSincronizacao: profundidadeFila(),
    });
  });
  await garantirIndicesSeExistirem(app);
  const porta = Number(process.env.PORT ?? 3000);
  await app.listen(porta, '0.0.0.0');
  console.log(
    JSON.stringify({ nivel: 'INFO', evento: 'api_pronta', porta, em: new Date().toISOString() }),
  );
}

bootstrap().catch((erro: unknown) => {
  const mensagem = erro instanceof Error ? erro.message : 'erro desconhecido';
  console.error(JSON.stringify({ nivel: 'ERROR', evento: 'api_nao_subiu', mensagem }));
  process.exit(1);
});
