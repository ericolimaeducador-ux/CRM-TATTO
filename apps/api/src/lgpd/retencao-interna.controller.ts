import { Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { Publico } from '../auth/papeis.decorator';
import { RespostaComErro } from '../contatos/erros-http';
import { ExpurgoService } from './expurgo.service';
import { CABECALHO_RETENCAO, tokenConfere } from './token-retencao';

@Controller('v1/interno')
@Publico()
export class RetencaoInternaController {
  constructor(private readonly expurgo: ExpurgoService) {}

  @Post('retencao')
  @HttpCode(200)
  async rodar(@Headers(CABECALHO_RETENCAO) token?: string | string[]) {
    const recebido = Array.isArray(token) ? token[0] : token;
    if (!tokenConfere(recebido, process.env.RETENCAO_TOKEN)) {
      throw new RespostaComErro(
        401,
        'RETENCAO_NAO_AUTORIZADA',
        'Token de retenção ausente ou inválido. Nada foi apagado.',
        null,
      );
    }
    const dados = await this.expurgo.rodar();
    return { dados, avisos: [], erros: [] };
  }
}
