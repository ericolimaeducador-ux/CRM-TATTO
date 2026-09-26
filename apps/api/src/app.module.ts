import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { descobrirModulos } from './composicao/descobrir-modulos';

const mongoUri = process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017/captura7';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(mongoUri),
    ...descobrirModulos(__dirname),
  ],
})
export class AppModule {}
