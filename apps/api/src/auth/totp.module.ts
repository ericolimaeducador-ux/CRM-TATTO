import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SessaoMiddleware } from '../contatos/sessao.middleware';
import { TotpController } from './totp.controller';
import { TotpService } from './totp.service';
import { usuarioTotpSchema } from './usuario-totp.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: 'UsuarioTotp', schema: usuarioTotpSchema }])],
  controllers: [TotpController],
  providers: [TotpService],
  exports: [TotpService],
})
export class TotpModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(SessaoMiddleware).forRoutes(TotpController);
  }
}
