import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { contatoAuditoriaSchema } from '../contatos/schemas/contato-auditoria.schema';
import { contatoSchema } from '../contatos/schemas/contato.schema';
import { contadorSchema } from '../contatos/schemas/contador.schema';
import { SessaoMiddleware } from '../contatos/sessao.middleware';
import { aplicarSegurancaNoSchema } from '../seguranca/aplicar-no-schema';
import { TotpModule } from '../auth/totp.module';
import { DedupService } from './dedup.service';
import { MergeService } from './merge.service';
import { QualidadeController } from './qualidade.controller';

aplicarSegurancaNoSchema(contatoSchema);

@Module({
  imports: [
    TotpModule,
    MongooseModule.forFeature([
      { name: 'Contato', schema: contatoSchema },
      { name: 'ContatoAuditoria', schema: contatoAuditoriaSchema },
      { name: 'Contador', schema: contadorSchema },
    ]),
  ],
  controllers: [QualidadeController],
  providers: [DedupService, MergeService],
})
export class QualidadeModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(SessaoMiddleware).forRoutes(QualidadeController);
  }
}
