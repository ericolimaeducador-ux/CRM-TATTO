import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SessaoMiddleware } from '../contatos/sessao.middleware';
import { contatoSchema } from '../contatos/schemas/contato.schema';
import { aplicarSegurancaNoSchema } from '../seguranca/aplicar-no-schema';
import { ExportacaoController } from './exportacao.controller';
import { exportacaoAuditoriaSchema } from './exportacao-auditoria.schema';
import { ExportacaoService } from './exportacao.service';

aplicarSegurancaNoSchema(contatoSchema);

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Contato', schema: contatoSchema },
      { name: 'ExportacaoAuditoria', schema: exportacaoAuditoriaSchema },
    ]),
  ],
  controllers: [ExportacaoController],
  providers: [ExportacaoService],
})
export class ExportacaoModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(SessaoMiddleware).forRoutes(ExportacaoController);
  }
}
