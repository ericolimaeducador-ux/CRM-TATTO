import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ContatosModule } from '../contatos/contatos.module';
import { SessaoMiddleware } from '../contatos/sessao.middleware';
import { contatoSchema } from '../contatos/schemas/contato.schema';
import { aplicarSegurancaNoSchema } from '../seguranca/aplicar-no-schema';
import { ImportacaoController } from './importacao.controller';
import { ImportacaoService } from './importacao.service';

aplicarSegurancaNoSchema(contatoSchema);

@Module({
  imports: [
    ContatosModule,
    MongooseModule.forFeature([{ name: 'Contato', schema: contatoSchema }]),
  ],
  controllers: [ImportacaoController],
  providers: [ImportacaoService],
})
export class ImportacaoModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(SessaoMiddleware).forRoutes(ImportacaoController);
  }
}
