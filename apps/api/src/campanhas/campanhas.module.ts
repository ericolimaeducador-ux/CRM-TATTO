import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { SessaoMiddleware } from '../contatos/sessao.middleware';
import { CampanhasController } from './campanhas.controller';
import { CampanhasService } from './campanhas.service';

@Module({
  controllers: [CampanhasController],
  providers: [CampanhasService],
  exports: [CampanhasService],
})
export class CampanhasModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(SessaoMiddleware).forRoutes(CampanhasController);
  }
}
