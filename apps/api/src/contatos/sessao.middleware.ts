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

export type ValidadorDeSessao = (token: string) => Promise<UsuarioSessao | null>;

let validadorDeSessao: ValidadorDeSessao | null = null;

export function registrarValidadorDeSessao(validador: ValidadorDeSessao | null): void {
  validadorDeSessao = validador;
}

@Injectable()
export class SessaoMiddleware implements NestMiddleware {
  async use(req: RequisicaoComUsuario, _res: Response, next: NextFunction): Promise<void> {
    const bruto = req.header('authorization') ?? '';
    if (bruto.toLowerCase().startsWith('bearer ') && validadorDeSessao) {
      const usuario = await validadorDeSessao(bruto.slice(7).trim());
      if (usuario) {
        req.usuario = usuario;
        next();
        return;
      }
    }
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
  if (process.env.NODE_ENV === 'production') return false;
  return process.env.NODE_ENV === 'test' || process.env.CAPTURA7_HEADERS_TESTE === '1';
}
