import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  CHAVE_PAPEIS,
  CHAVE_PUBLICO,
  CHAVE_SEM_TOTP,
  CHAVE_SENHA_PROVISORIA,
  CHAVE_STEP_UP,
} from './papeis.decorator';

interface UsuarioDaRequisicao {
  papel?: string;
  stepUp?: boolean;
  totpPendente?: boolean;
  trocarSenhaObrigatoria?: boolean;
}

@Injectable()
export class PapelGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const alvos = [contexto.getHandler(), contexto.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(CHAVE_PUBLICO, alvos)) return true;

    const papeis = this.reflector.getAllAndOverride<string[]>(CHAVE_PAPEIS, alvos);
    if (!papeis || papeis.length === 0) {
      throw new ForbiddenException({
        codigo: 'PAPEL_INSUFICIENTE',
        mensagem:
          'Esta rota não declara papel. O acesso fica negado. Peça a um admin para publicar a permissão.',
      });
    }

    const usuario = this.usuario(contexto);
    if (!usuario.papel || !papeis.includes(usuario.papel)) {
      throw new ForbiddenException({
        codigo: 'PAPEL_INSUFICIENTE',
        mensagem: 'Seu papel não faz esta ação. Se a tarefa é sua, peça a um gestor ou admin.',
      });
    }

    if (
      usuario.trocarSenhaObrigatoria === true &&
      !this.reflector.getAllAndOverride<boolean>(CHAVE_SENHA_PROVISORIA, alvos)
    ) {
      throw new ForbiddenException({
        codigo: 'SENHA_PROVISORIA',
        mensagem:
          'Crie sua nova senha antes de continuar. A senha provisória só serve para esse primeiro passo. Nada foi alterado.',
      });
    }

    if (
      usuario.totpPendente === true &&
      !this.reflector.getAllAndOverride<boolean>(CHAVE_SEM_TOTP, alvos)
    ) {
      throw new ForbiddenException({
        codigo: 'TOTP_NAO_INSCRITO',
        mensagem:
          'O administrador precisa inscrever o autenticador neste primeiro acesso. As outras ações ficam fechadas até lá.',
      });
    }

    if (
      this.reflector.getAllAndOverride<boolean>(CHAVE_STEP_UP, alvos) &&
      usuario.stepUp !== true
    ) {
      throw new ForbiddenException({
        codigo: 'STEP_UP_NECESSARIO',
        mensagem:
          'Esta ação pede confirmação TOTP. Informe o código e tente de novo. A captura não pede isso.',
      });
    }

    return true;
  }

  private usuario(contexto: ExecutionContext): UsuarioDaRequisicao {
    const requisicao = contexto.switchToHttp().getRequest<{ usuario?: UsuarioDaRequisicao }>();
    return requisicao.usuario ?? {};
  }
}
