import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { PAPEIS } from './perfil-permissoes';
import { Papel, SemTotp } from './papeis.decorator';
import { RespostaComErro } from '../contatos/erros-http';
import type { RequisicaoComUsuario, UsuarioSessao } from '../contatos/sessao.middleware';
import { TotpService } from './totp.service';

@Controller('v1/auth/totp')
export class TotpController {
  constructor(private readonly totp: TotpService) {}

  @Post('inscrever')
  @Papel(...PAPEIS)
  @SemTotp()
  async inscrever(@Req() req: RequisicaoComUsuario, @Body() corpo: { codigoTotp?: string }) {
    const usuario = exigirUsuario(req);
    const dados = await this.totp.inscrever(usuario.id, {
      codigoAtual: corpo?.codigoTotp,
      stepUp: usuario.stepUp === true,
    });
    return { dados, avisos: [], erros: [] };
  }

  @Post('ativar')
  @HttpCode(200)
  @Papel(...PAPEIS)
  @SemTotp()
  async ativar(@Req() req: RequisicaoComUsuario, @Body() corpo: { codigoTotp?: string }) {
    const usuario = exigirUsuario(req);
    const dados = await this.totp.ativar(usuario.id, corpo?.codigoTotp ?? '');
    return { dados, avisos: [], erros: [] };
  }
}

function exigirUsuario(req: RequisicaoComUsuario): UsuarioSessao {
  if (!req.usuario?.id) {
    throw new RespostaComErro(
      403,
      'PAPEL_INSUFICIENTE',
      'A sessão não identificou quem está gravando. Entre de novo e repita. Nada foi atribuído a um autor fictício.',
      null,
    );
  }
  return req.usuario;
}
