import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { RespostaComErro } from '../contatos/erros-http';
import type { RequisicaoComUsuario, UsuarioSessao } from '../contatos/sessao.middleware';
import { ExigeStepUp, Papel } from './papeis.decorator';
import { UsuariosService } from './usuarios.service';

@Controller('v1/usuarios')
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Get()
  @Papel('admin')
  async listar(@Req() req: RequisicaoComUsuario) {
    exigir(req);
    return { dados: await this.usuarios.listar(), avisos: [], erros: [] };
  }

  @Post()
  @Papel('admin')
  async criar(
    @Body() corpo: { login?: string; senha?: string; nome?: string; papel?: string },
    @Req() req: RequisicaoComUsuario,
  ) {
    exigir(req);
    const dados = await this.usuarios.criar(
      corpo.login ?? '',
      corpo.senha ?? '',
      corpo.nome ?? '',
      corpo.papel ?? '',
    );
    return { dados, avisos: [], erros: [] };
  }

  @Patch(':id')
  @Papel('admin')
  @ExigeStepUp()
  async atualizar(
    @Param('id') id: string,
    @Body() corpo: { papel?: string; ativo?: boolean },
    @Req() req: RequisicaoComUsuario,
  ) {
    exigir(req);
    const dados = await this.usuarios.atualizar(id, corpo.papel, corpo.ativo);
    return { dados, avisos: [], erros: [] };
  }

  @Post(':id/totp/zerar')
  @Papel('admin')
  @ExigeStepUp()
  async zerar(@Param('id') id: string, @Req() req: RequisicaoComUsuario) {
    exigir(req);
    return { dados: await this.usuarios.zerarTotp(id), avisos: [], erros: [] };
  }
}

function exigir(req: RequisicaoComUsuario): UsuarioSessao {
  if (!req.usuario?.id) {
    throw new RespostaComErro(
      403,
      'PAPEL_INSUFICIENTE',
      'Entre como administrador. Nada foi alterado.',
      null,
    );
  }
  return req.usuario;
}
