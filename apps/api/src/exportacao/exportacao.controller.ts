import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ExigeStepUp, Papel } from '../auth/papeis.decorator';
import { RespostaComErro } from '../contatos/erros-http';
import type { RequisicaoComUsuario, UsuarioSessao } from '../contatos/sessao.middleware';
import { ExportacaoService } from './exportacao.service';

@Controller('v1/exportacoes')
export class ExportacaoController {
  constructor(private readonly exportacao: ExportacaoService) {}

  @Get()
  @Papel('admin')
  @ExigeStepUp()
  async baixar(
    @Query('formato') formato: string | undefined,
    @Query('status') status: string | undefined,
    @Query('origem') origem: string | undefined,
    @Req() req: RequisicaoComUsuario,
    @Res() res: Response,
  ) {
    const arquivo = await this.exportacao.gerar(formato, status, origem, exigir(req));
    res.status(200);
    res.setHeader('content-type', arquivo.tipo);
    res.setHeader('content-disposition', `attachment; filename="${arquivo.nome}"`);
    res.send(arquivo.corpo);
  }
}

function exigir(req: RequisicaoComUsuario): UsuarioSessao {
  if (!req.usuario?.id) {
    throw new RespostaComErro(
      403,
      'PAPEL_INSUFICIENTE',
      'A sessão não identificou quem exporta. Entre de novo. Nada foi exportado.',
      null,
    );
  }
  return req.usuario;
}
