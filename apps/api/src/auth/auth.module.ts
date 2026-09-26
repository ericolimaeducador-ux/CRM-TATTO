import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { SessaoMiddleware } from '../contatos/sessao.middleware';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';
import { PapelGuard } from './papel.guard';
import { authAuditoriaSchema } from './auth-auditoria.schema';
import { sessaoTokenSchema } from './sessao-token.schema';
import { TotpModule } from './totp.module';
import { usuarioSchema } from './usuario.schema';

@Module({
  imports: [
    TotpModule,
    MongooseModule.forFeature([
      { name: 'Usuario', schema: usuarioSchema },
      { name: 'SessaoToken', schema: sessaoTokenSchema },
      { name: 'AuthAuditoria', schema: authAuditoriaSchema },
    ]),
  ],
  controllers: [AuthController, UsuariosController],
  providers: [
    AuthService,
    UsuariosService,
    PapelGuard,
    { provide: APP_GUARD, useClass: PapelGuard },
  ],
  exports: [AuthService],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(SessaoMiddleware).forRoutes(AuthController, UsuariosController);
  }
}
