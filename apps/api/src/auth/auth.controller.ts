import { Body, Controller, Get, Headers, Post, Req } from '@nestjs/common';
import { Papel, Publico } from './papeis.decorator';
import { PAPEIS } from './perfil-permissoes';
import { RespostaComErro } from '../contatos/erros-http';
import type { RequisicaoComUsuario, UsuarioSessao } from '../contatos/sessao.middleware';
import { AuthService } from './auth.service';

@Controller('v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('entrar')
  @Publico()
  async entrar(@Body() corpo: { login?: string; senha?: string; codigoTotp?: string }) {
    const dados = await this.auth.entrar(corpo.login ?? '', corpo.senha ?? '', corpo.codigoTotp);
    return { dados, avisos: [], erros: [] };
  }

  @Post('step-up')
  @Papel(...PAPEIS)
  async stepUp(
    @Headers('authorization') authorization: string | undefined,
    @Body() corpo: { codigoTotp?: string },
    @Req() req: RequisicaoComUsuario,
  ) {
    exigir(req);
    const token = (authorization ?? '').replace(/^Bearer\s+/i, '').trim();
    const dados = await this.auth.stepUp(token, corpo.codigoTotp ?? '');
    return { dados, avisos: [], erros: [] };
  }

  @Get('eu')
  @Papel(...PAPEIS)
  eu(@Req() req: RequisicaoComUsuario) {
    const usuario = exigir(req);
    return { dados: usuario, avisos: [], erros: [] };
  }
}

function exigir(req: RequisicaoComUsuario): UsuarioSessao {
  if (!req.usuario?.id) {
    throw new RespostaComErro(
      401,
      'SESSAO_AUSENTE',
      'Entre com usuário e senha. Nada foi aberto.',
      null,
    );
  }
  return req.usuario;
}
