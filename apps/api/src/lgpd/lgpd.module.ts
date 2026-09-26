import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { contadorSchema } from '../contatos/schemas/contador.schema';
import { contatoAuditoriaSchema } from '../contatos/schemas/contato-auditoria.schema';
import { contatoSchema } from '../contatos/schemas/contato.schema';
import { SessaoMiddleware } from '../contatos/sessao.middleware';
import { aplicarSegurancaNoSchema } from '../seguranca/aplicar-no-schema';
import { AutocadastroService } from './autocadastro.service';
import { ExpurgoService } from './expurgo.service';
import { ConsentimentoController, PublicoController, QrController } from './lgpd.controller';
import { ConsentimentoService } from './consentimento.service';
import { tokenAutocadastroSchema } from './token-autocadastro.schema';

aplicarSegurancaNoSchema(contatoSchema);

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Contato', schema: contatoSchema },
      { name: 'ContatoAuditoria', schema: contatoAuditoriaSchema },
      { name: 'Contador', schema: contadorSchema },
      { name: 'TokenAutocadastro', schema: tokenAutocadastroSchema },
    ]),
  ],
  controllers: [PublicoController, QrController, ConsentimentoController],
  providers: [ConsentimentoService, AutocadastroService, ExpurgoService],
})
export class LgpdModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(SessaoMiddleware).forRoutes(QrController, ConsentimentoController);
  }
}
