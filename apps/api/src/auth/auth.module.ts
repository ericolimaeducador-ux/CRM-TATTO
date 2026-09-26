import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PapelGuard } from './papel.guard';

@Module({
  providers: [PapelGuard, { provide: APP_GUARD, useClass: PapelGuard }],
})
export class AuthModule {}
