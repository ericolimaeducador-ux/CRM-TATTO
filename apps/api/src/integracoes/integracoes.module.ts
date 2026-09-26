import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
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

aplicarSegurancaNoSchema(contatoSchema);

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Contato', schema: contatoSchema },
      { name: 'ContatoAuditoria', schema: contatoAuditoriaSchema },
      { name: 'Contador', schema: contadorSchema },
      { name: 'CacheEnriquecimento', schema: cacheEnriquecimentoSchema },
    ]),
  ],
  controllers: [EnriquecimentoController],
  providers: [EnriquecimentoService, ClienteHttp, FontesOficiais],
  exports: [EnriquecimentoService, ClienteHttp, FontesOficiais],
})
export class IntegracoesModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(SessaoMiddleware).forRoutes(EnriquecimentoController);
  }
}
