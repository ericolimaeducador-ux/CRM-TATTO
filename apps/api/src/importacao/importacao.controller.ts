import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { Papel } from '../auth/papeis.decorator';
import { RespostaComErro } from '../contatos/erros-http';
import type { RequisicaoComUsuario, UsuarioSessao } from '../contatos/sessao.middleware';
import { ImportacaoService } from './importacao.service';

@Controller('v1/importacoes')
export class ImportacaoController {
  constructor(private readonly importacao: ImportacaoService) {}

  @Post()
  @HttpCode(200)
  @Papel('gestor', 'admin')
  importar(
    @Body() corpo: { texto?: string; xlsxBase64?: string },
    @Req() req: RequisicaoComUsuario,
  ) {
    return this.importacao.importar(corpo ?? {}, exigir(req));
  }
}

function exigir(req: RequisicaoComUsuario): UsuarioSessao {
  if (!req.usuario?.id) {
    throw new RespostaComErro(
      403,
      'PAPEL_INSUFICIENTE',
      'A sessão não identificou quem importa. Entre de novo. Nada foi gravado.',
      null,
    );
  }
  return req.usuario;
}
