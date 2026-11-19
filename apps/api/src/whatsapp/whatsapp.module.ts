import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SessaoMiddleware } from '../contatos/sessao.middleware';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';
import {
  bloqueioWhatsAppSchema,
  controleWhatsAppSchema,
  reciboWhatsAppSchema,
  trabalhoWhatsAppSchema,
} from './whatsapp.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'WhatsAppTrabalho', schema: trabalhoWhatsAppSchema },
      { name: 'WhatsAppControle', schema: controleWhatsAppSchema },
      { name: 'WhatsAppBloqueio', schema: bloqueioWhatsAppSchema },
      { name: 'WhatsAppRecibo', schema: reciboWhatsAppSchema },
    ]),
  ],
  controllers: [WhatsAppController],
  providers: [WhatsAppService],
  exports: [WhatsAppService],
})
export class WhatsAppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(SessaoMiddleware).forRoutes(WhatsAppController);
  }
}
