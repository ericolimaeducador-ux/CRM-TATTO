import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { Papel, Publico } from '../auth/papeis.decorator';
import { ExigeStepUp } from '../auth/papeis.decorator';
import { Res } from '@nestjs/common';
import type { Response } from 'express';
import type { RequisicaoComUsuario, UsuarioSessao } from '../contatos/sessao.middleware';
import { ComercialService } from './comercial.service';
import { falha } from './comercial.campos';

@Controller('v1/comercial')
export class ComercialController {
  constructor(private readonly comercial: ComercialService) {}
  @Get('publico/treinamentos/:token')
  @Publico()
  consultaPublicaTreinamento(@Param('token') token: string) {
    return this.comercial.consultaPublicaTreinamento(token);
  }
  @Post('publico/treinamentos/:token')
  @Publico()
  inscreverPublicoTreinamento(
    @Param('token') token: string,
    @Body() corpo: Record<string, unknown>,
    @Req() req: RequisicaoComUsuario,
  ) {
    return this.comercial.inscreverPublico(
      token,
      corpoValido(corpo),
      req.ip ?? req.socket.remoteAddress ?? '',
    );
  }
  @Post('treinamentos/:id/qr')
  @Papel('vendedor', 'gestor', 'admin')
  criarQrTreinamento(@Param('id') id: string, @Req() req: RequisicaoComUsuario) {
    return this.comercial.criarQrTreinamento(id, usuario(req));
  }
  @Post('precosCliente/:id/aprovar')
  @Papel('gestor', 'admin')
  aprovarPreco(
    @Param('id') id: string,
    @Body() corpo: Record<string, unknown>,
    @Req() req: RequisicaoComUsuario,
  ) {
    return this.comercial.decidirPreco(id, 'aprovar', corpoValido(corpo), usuario(req));
  }
  @Post('precosCliente/:id/reprovar')
  @Papel('gestor', 'admin')
  reprovarPreco(
    @Param('id') id: string,
    @Body() corpo: Record<string, unknown>,
    @Req() req: RequisicaoComUsuario,
  ) {
    return this.comercial.decidirPreco(id, 'reprovar', corpoValido(corpo), usuario(req));
  }
  @Post('precosCliente/:id/encerrar')
  @Papel('vendedor', 'gestor', 'admin')
  encerrarPreco(
    @Param('id') id: string,
    @Body() corpo: Record<string, unknown>,
    @Req() req: RequisicaoComUsuario,
  ) {
    return this.comercial.encerrarPreco(id, corpoValido(corpo), usuario(req));
  }
  @Get('painel')
  @Papel('vendedor', 'gestor', 'admin', 'auditor')
  painel(@Req() req: RequisicaoComUsuario) {
    return this.comercial.painel(usuario(req));
  }
  @Get('relatorios')
  @Papel('vendedor', 'gestor', 'admin', 'auditor')
  relatorios(@Query() query: Record<string, unknown>, @Req() req: RequisicaoComUsuario) {
    return this.comercial.relatorios(query, usuario(req));
  }
  @Get('treinamentos/:id/participantes/exportar')
  @Papel('gestor', 'admin')
  @ExigeStepUp()
  async exportarParticipantes(
    @Param('id') id: string,
    @Query('formato') formato: string | undefined,
    @Req() req: RequisicaoComUsuario,
    @Res() res: Response,
  ) {
    const arquivo = await this.comercial.exportarParticipantes(id, formato, usuario(req));
    res.status(200);
    res.setHeader('content-type', arquivo.tipo);
    res.setHeader('content-disposition', `attachment; filename="${arquivo.nome}"`);
    res.send(arquivo.corpo);
  }
  @Get(':tipo')
  @Papel('vendedor', 'gestor', 'admin', 'auditor')
  listar(
    @Param('tipo') tipo: string,
    @Query() query: Record<string, string>,
    @Req() req: RequisicaoComUsuario,
  ) {
    return this.comercial.listar(tipo, query, usuario(req));
  }
  @Get(':tipo/:id/auditoria')
  @Papel('vendedor', 'gestor', 'admin', 'auditor')
  auditoria(
    @Param('tipo') tipo: string,
    @Param('id') id: string,
    @Req() req: RequisicaoComUsuario,
  ) {
    return this.comercial.auditoria(tipo, id, usuario(req));
  }
  @Get(':tipo/:id')
  @Papel('vendedor', 'gestor', 'admin', 'auditor')
  obter(@Param('tipo') tipo: string, @Param('id') id: string, @Req() req: RequisicaoComUsuario) {
    return this.comercial.obter(tipo, id, usuario(req));
  }
  @Post('propostas/:id/rascunho-email')
  @Papel('vendedor', 'gestor', 'admin')
  solicitarRascunhoEmailProposta(
    @Param('id') id: string,
    @Body() corpo: Record<string, unknown>,
    @Req() req: RequisicaoComUsuario,
  ) {
    return this.comercial.solicitarRascunhoEmailProposta(id, corpoValido(corpo), usuario(req));
  }
  @Post(':tipo')
  @Papel('vendedor', 'gestor', 'admin')
  criar(
    @Param('tipo') tipo: string,
    @Body() corpo: Record<string, unknown>,
    @Req() req: RequisicaoComUsuario,
  ) {
    return this.comercial.criar(tipo, corpoValido(corpo), usuario(req));
  }
  @Patch(':tipo/:id')
  @Papel('vendedor', 'gestor', 'admin')
  atualizar(
    @Param('tipo') tipo: string,
    @Param('id') id: string,
    @Body() corpo: Record<string, unknown>,
    @Req() req: RequisicaoComUsuario,
  ) {
    return this.comercial.atualizar(tipo, id, corpoValido(corpo), usuario(req));
  }
}
function usuario(req: RequisicaoComUsuario): UsuarioSessao {
  if (!req.usuario?.id) falha('Entre para abrir sua carteira comercial.', 'SESSAO_AUSENTE', 401);
  return req.usuario as UsuarioSessao;
}
function corpoValido(corpo: unknown): Record<string, unknown> {
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo))
    falha('Envie os campos do cadastro.');
  return corpo as Record<string, unknown>;
}
