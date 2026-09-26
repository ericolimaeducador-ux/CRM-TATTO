import { Body, Controller, Get, HttpCode, Param, Post, Req } from '@nestjs/common';
import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';
import { PERFIL_PERMISSOES } from '../auth/perfil-permissoes';
import { ExigeStepUp, Papel } from '../auth/papeis.decorator';
import { RespostaComErro } from '../contatos/erros-http';
import type { RequisicaoComUsuario, UsuarioSessao } from '../contatos/sessao.middleware';
import { DedupService } from './dedup.service';
import { MergeService } from './merge.service';

class MergeDto {
  @IsOptional()
  @IsString()
  absorvidoId?: string;

  @IsOptional()
  @IsObject()
  valoresEscolhidos?: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  confirmacao?: boolean;
}

@Controller('v1')
export class QualidadeController {
  constructor(
    private readonly dedup: DedupService,
    private readonly merge: MergeService,
  ) {}

  @Get('duplicatas')
  @Papel('gestor', 'admin')
  listar(@Req() req: RequisicaoComUsuario) {
    return this.dedup.listar(exigir(req));
  }

  @Get('contatos/:id/duplicatas')
  @Papel('gestor', 'admin')
  deUm(@Param('id') id: string, @Req() req: RequisicaoComUsuario) {
    return this.dedup.deUm(id, exigir(req));
  }

  @Post('contatos/:id/merge')
  @HttpCode(200)
  @Papel(...PERFIL_PERMISSOES.fundir)
  @ExigeStepUp()
  fundir(@Param('id') id: string, @Body() corpo: MergeDto, @Req() req: RequisicaoComUsuario) {
    return this.merge.fundir(
      id,
      corpo.absorvidoId,
      corpo.valoresEscolhidos,
      corpo.confirmacao,
      exigir(req),
    );
  }

  @Post('contatos/:id/recuperar')
  @HttpCode(200)
  @Papel(...PERFIL_PERMISSOES.fundir)
  @ExigeStepUp()
  recuperar(@Param('id') id: string, @Req() req: RequisicaoComUsuario) {
    return this.merge.recuperar(id, exigir(req));
  }
}

function exigir(req: RequisicaoComUsuario): UsuarioSessao {
  if (!req.usuario?.id) {
    throw new RespostaComErro(
      403,
      'PAPEL_INSUFICIENTE',
      'A sessão não identificou quem decide a fusão. Entre de novo. Nada foi alterado.',
      null,
    );
  }
  return req.usuario;
}
