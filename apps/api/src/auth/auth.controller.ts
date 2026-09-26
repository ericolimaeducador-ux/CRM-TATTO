import { Body, Controller, Get, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { Papel, Publico, SemTotp } from './papeis.decorator';
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
  @SemTotp()
  eu(@Req() req: RequisicaoComUsuario) {
    const usuario = exigir(req);
    return { dados: usuario, avisos: [], erros: [] };
  }

  @Post('sair')
  @HttpCode(200)
  @Papel(...PAPEIS)
  @SemTotp()
  async sair(
    @Headers('authorization') authorization: string | undefined,
    @Req() req: RequisicaoComUsuario,
  ) {
    exigir(req);
    await this.auth.sair((authorization ?? '').replace(/^Bearer\s+/i, '').trim());
    return { dados: { encerrada: true }, avisos: [], erros: [] };
  }

  @Post('senha')
  @HttpCode(200)
  @Papel(...PAPEIS)
  @SemTotp()
  async senha(
    @Body() corpo: { senhaAtual?: string; senhaNova?: string },
    @Req() req: RequisicaoComUsuario,
  ) {
    const usuario = exigir(req);
    const dados = await this.auth.trocarSenha(
      usuario.id,
      corpo.senhaAtual ?? '',
      corpo.senhaNova ?? '',
    );
    return { dados, avisos: [], erros: [] };
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
