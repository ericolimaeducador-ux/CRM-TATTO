import {
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  type RawBodyRequest,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Papel, Publico } from '../auth/papeis.decorator';
import type { RequisicaoComUsuario } from '../contatos/sessao.middleware';
import { WhatsAppService } from './whatsapp.service';

@Controller('v1/whatsapp')
export class WhatsAppController {
  constructor(private readonly whatsapp: WhatsAppService) {}

  @Get('status')
  @Papel('gestor', 'admin')
  status(@Req() req: RequisicaoComUsuario) {
    return this.whatsapp.status(req.usuario?.id ?? '');
  }

  @Get('webhook')
  @Publico()
  verificar(@Query() query: Record<string, unknown>, @Res() res: Response) {
    const desafio = this.whatsapp.verificarWebhook(query);
    res.type('text/plain').status(200).send(desafio);
  }

  @Post('webhook')
  @HttpCode(200)
  @Publico()
  async receber(@Req() req: RawBodyRequest<Request>) {
    await this.whatsapp.receberWebhook(req.rawBody, req.header('x-hub-signature-256'));
    return { recebido: true };
  }
}
