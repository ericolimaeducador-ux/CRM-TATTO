import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { contadorSchema } from '../contatos/schemas/contador.schema';
import { contatoAuditoriaSchema } from '../contatos/schemas/contato-auditoria.schema';
import { contatoSchema } from '../contatos/schemas/contato.schema';
import { SessaoMiddleware } from '../contatos/sessao.middleware';
import { aplicarSegurancaNoSchema } from '../seguranca/aplicar-no-schema';
import { AutocadastroService } from './autocadastro.service';
import { AtualizacaoCadastroService } from './atualizacao-cadastro.service';
import { ExpurgoService } from './expurgo.service';
import {
  AtualizacaoCadastroController,
  ConsentimentoController,
  PublicoController,
  QrController,
} from './lgpd.controller';
import { RetencaoInternaController } from './retencao-interna.controller';
import { ConsentimentoService } from './consentimento.service';
import { tokenAutocadastroSchema } from './token-autocadastro.schema';
import { tokenAtualizacaoCadastroSchema } from './token-atualizacao-cadastro.schema';

aplicarSegurancaNoSchema(contatoSchema);

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Contato', schema: contatoSchema },
      { name: 'ContatoAuditoria', schema: contatoAuditoriaSchema },
      { name: 'Contador', schema: contadorSchema },
      { name: 'TokenAutocadastro', schema: tokenAutocadastroSchema },
      { name: 'TokenAtualizacaoCadastro', schema: tokenAtualizacaoCadastroSchema },
    ]),
  ],
  controllers: [
    PublicoController,
    QrController,
    ConsentimentoController,
    AtualizacaoCadastroController,
    RetencaoInternaController,
  ],
  providers: [
    ConsentimentoService,
    AutocadastroService,
    AtualizacaoCadastroService,
    ExpurgoService,
  ],
})
export class LgpdModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(SessaoMiddleware)
      .forRoutes(QrController, ConsentimentoController, AtualizacaoCadastroController);
  }
}
