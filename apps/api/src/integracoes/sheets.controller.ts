import { Controller, HttpCode, Post, Req } from '@nestjs/common';
import { Papel } from '../auth/papeis.decorator';
import { RespostaComErro } from '../contatos/erros-http';
import type { RequisicaoComUsuario, UsuarioSessao } from '../contatos/sessao.middleware';
import { SheetsService } from './sheets.service';

@Controller('v1/integracoes/sheets')
export class SheetsController {
  constructor(private readonly sheets: SheetsService) {}

  @Post('sincronizar')
  @HttpCode(200)
  @Papel('gestor', 'admin')
  sincronizar(@Req() req: RequisicaoComUsuario) {
    return this.sheets.sincronizar(exigir(req));
  }
}

function exigir(req: RequisicaoComUsuario): UsuarioSessao {
  if (!req.usuario?.id) {
    throw new RespostaComErro(
      403,
      'PAPEL_INSUFICIENTE',
      'A sessão não identificou quem pede a planilha. Entre de novo. A captura manual continua.',
      null,
    );
  }
  return req.usuario;
}
