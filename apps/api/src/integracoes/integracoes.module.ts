import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ContatosModule } from '../contatos/contatos.module';
import { contatoAuditoriaSchema } from '../contatos/schemas/contato-auditoria.schema';
import { contatoSchema } from '../contatos/schemas/contato.schema';
import { contadorSchema } from '../contatos/schemas/contador.schema';
import { SessaoMiddleware } from '../contatos/sessao.middleware';
import { aplicarSegurancaNoSchema } from '../seguranca/aplicar-no-schema';
import { cacheEnriquecimentoSchema } from './cache.schema';
import { ClienteHttp } from './cliente-http';
import { EnriquecimentoController } from './enriquecimento.controller';
import { EnriquecimentoService } from './enriquecimento.service';
import { FontesOficiais } from './fontes-oficiais';
import { planilhaLinhaSchema, planilhaMarcaSchema } from './planilha.schema';
import { SheetsController } from './sheets.controller';
import { SheetsService } from './sheets.service';
import { webhookSaidaSchema } from './webhook-saida.schema';
import { WebhookSaidaService } from './webhook-saida.service';

aplicarSegurancaNoSchema(contatoSchema);

@Module({
  imports: [
    ContatosModule,
    MongooseModule.forFeature([
      { name: 'Contato', schema: contatoSchema },
      { name: 'ContatoAuditoria', schema: contatoAuditoriaSchema },
      { name: 'Contador', schema: contadorSchema },
      { name: 'CacheEnriquecimento', schema: cacheEnriquecimentoSchema },
      { name: 'PlanilhaLinha', schema: planilhaLinhaSchema },
      { name: 'PlanilhaMarca', schema: planilhaMarcaSchema },
      { name: 'WebhookSaida', schema: webhookSaidaSchema },
    ]),
  ],
  controllers: [EnriquecimentoController, SheetsController],
  providers: [
    EnriquecimentoService,
    ClienteHttp,
    FontesOficiais,
    SheetsService,
    WebhookSaidaService,
  ],
  exports: [EnriquecimentoService, ClienteHttp, FontesOficiais, SheetsService, WebhookSaidaService],
})
export class IntegracoesModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(SessaoMiddleware).forRoutes(EnriquecimentoController, SheetsController);
  }
}
