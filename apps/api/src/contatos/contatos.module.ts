import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { aplicarSegurancaNoSchema } from '../seguranca/aplicar-no-schema';
import { AuditoriaInterceptor } from './autoria.interceptor';
import { AvisosPipe } from './avisos.pipe';
import { contadorSchema } from './schemas/contador.schema';
import { contatoAuditoriaSchema } from './schemas/contato-auditoria.schema';
import { contatoSchema } from './schemas/contato.schema';
import { ContatosController } from './contatos.controller';
import { ContatosService } from './contatos.service';
import { FiltroErros } from './filtro-erros';
import { LoteService } from './lote.service';
import { SessaoMiddleware } from './sessao.middleware';
import { TransicaoService } from './transicao.service';

aplicarSegurancaNoSchema(contatoSchema);

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Contato', schema: contatoSchema },
      { name: 'ContatoAuditoria', schema: contatoAuditoriaSchema },
      { name: 'Contador', schema: contadorSchema },
    ]),
  ],
  controllers: [ContatosController],
  exports: [ContatosService],
  providers: [
    ContatosService,
    TransicaoService,
    LoteService,
    { provide: APP_INTERCEPTOR, useClass: AuditoriaInterceptor },
    { provide: APP_FILTER, useClass: FiltroErros },
    { provide: APP_PIPE, useClass: AvisosPipe },
  ],
})
export class ContatosModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(SessaoMiddleware).forRoutes(ContatosController);
  }
}
