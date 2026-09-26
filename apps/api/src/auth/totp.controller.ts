import { Controller, Post, Req } from '@nestjs/common';
import { PERFIL_PERMISSOES } from './perfil-permissoes';
import { Papel } from './papeis.decorator';
import { RespostaComErro } from '../contatos/erros-http';
import type { RequisicaoComUsuario, UsuarioSessao } from '../contatos/sessao.middleware';
import { TotpService } from './totp.service';

@Controller('v1/auth/totp')
export class TotpController {
  constructor(private readonly totp: TotpService) {}

  @Post('inscrever')
  @Papel(...PERFIL_PERMISSOES.transicionar_cliente)
  async inscrever(@Req() req: RequisicaoComUsuario) {
    const usuario = exigirUsuario(req);
    const dados = await this.totp.inscrever(usuario.id);
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
