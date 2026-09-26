import type { NextFunction, Request, Response } from 'express';
import { Injectable, type NestMiddleware } from '@nestjs/common';
import { Types } from 'mongoose';

export interface UsuarioSessao {
  id: string;
  papel: string;
  nome: string;
  stepUp: boolean;
}

export type RequisicaoComUsuario = Request & { usuario?: UsuarioSessao };

@Injectable()
export class SessaoMiddleware implements NestMiddleware {
  use(req: RequisicaoComUsuario, _res: Response, next: NextFunction): void {
    if (!headersDeTesteAtivos()) {
      next();
      return;
    }
    const papel = req.header('x-papel-teste');
    const id = req.header('x-usuario-id');
    if (!papel || !id || !Types.ObjectId.isValid(id)) {
      next();
      return;
    }
    req.usuario = {
      id,
      papel,
      nome: req.header('x-autor-nome')?.trim() || 'sessão de teste',
      stepUp: req.header('x-step-up-teste') === '1',
    };
    next();
  }
}

function headersDeTesteAtivos(): boolean {
  return process.env.NODE_ENV === 'test' || process.env.CAPTURA7_HEADERS_TESTE === '1';
}
