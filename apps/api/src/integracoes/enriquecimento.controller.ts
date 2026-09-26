import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { PERFIL_PERMISSOES } from '../auth/perfil-permissoes';
import { Papel } from '../auth/papeis.decorator';
import { RespostaComErro } from '../contatos/erros-http';
import type { RequisicaoComUsuario, UsuarioSessao } from '../contatos/sessao.middleware';
import { EnriquecimentoService } from './enriquecimento.service';

class CnpjDto {
  @IsOptional()
  @IsString()
  contatoId?: string;

  @IsOptional()
  @IsString()
  cnpj?: string;
}

@Controller('v1/enriquecimento')
export class EnriquecimentoController {
  constructor(private readonly enriquecimento: EnriquecimentoService) {}

  @Post('cnpj')
  @HttpCode(200)
  @Papel(...PERFIL_PERMISSOES.editar_contato)
  cnpj(@Body() corpo: CnpjDto, @Req() req: RequisicaoComUsuario) {
    return this.enriquecimento.cnpj(corpo.contatoId, corpo.cnpj, exigir(req));
  }

  @Get('cep/:cep')
  @Papel(...PERFIL_PERMISSOES.editar_contato)
  cep(
    @Param('cep') cep: string,
    @Query('contatoId') contatoId: string | undefined,
    @Req() req: RequisicaoComUsuario,
  ) {
    return this.enriquecimento.cep(contatoId, cep, exigir(req));
  }
}

function exigir(req: RequisicaoComUsuario): UsuarioSessao {
  if (!req.usuario?.id) {
    throw new RespostaComErro(
      403,
      'PAPEL_INSUFICIENTE',
      'A sessão não identificou quem está enriquecendo. Entre de novo. Nada foi consultado.',
      null,
    );
  }
  return req.usuario;
}
