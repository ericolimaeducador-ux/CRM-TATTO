import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SessaoMiddleware } from '../contatos/sessao.middleware';
import { ComercialController } from './comercial.controller';
import { ComercialService } from './comercial.service';
import { comercialSchema } from './comercial.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: 'Comercial', schema: comercialSchema }])],
  controllers: [ComercialController],
  providers: [ComercialService],
  exports: [ComercialService],
})
export class ComercialModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(SessaoMiddleware).forRoutes(ComercialController);
  }
}
