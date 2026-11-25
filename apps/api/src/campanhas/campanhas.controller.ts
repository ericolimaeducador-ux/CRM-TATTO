import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { Papel } from '../auth/papeis.decorator';
import type { RequisicaoComUsuario, UsuarioSessao } from '../contatos/sessao.middleware';
import { falha } from '../comercial/comercial.campos';
import { CampanhasService } from './campanhas.service';

@Controller('v1/campanhas')
@Papel('vendedor', 'gestor', 'admin')
export class CampanhasController {
  constructor(private readonly campanhas: CampanhasService) {}
  @Get('configuracao') configuracao() {
    return this.campanhas.configuracao();
  }
  @Get('templates') templates() {
    return this.campanhas.templates();
  }
  @Get('candidatos') candidatos(
    @Query() query: Record<string, unknown>,
    @Req() req: RequisicaoComUsuario,
  ) {
    return this.campanhas.candidatos(query, usuario(req));
  }
  @Get('pendencias') pendencias(
    @Query() query: Record<string, unknown>,
    @Req() req: RequisicaoComUsuario,
  ) {
    return this.campanhas.pendencias(query, usuario(req));
  }
  @Get() listar(@Query() query: Record<string, unknown>, @Req() req: RequisicaoComUsuario) {
    return this.campanhas.listar(query, usuario(req));
  }
  @Post() criar(@Body() body: Record<string, unknown>, @Req() req: RequisicaoComUsuario) {
    return this.campanhas.criar(corpo(body), usuario(req));
  }
  @Get(':id') obter(@Param('id') id: string, @Req() req: RequisicaoComUsuario) {
    return this.campanhas.obter(id, usuario(req));
  }
  @Patch(':id') editar(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: RequisicaoComUsuario,
  ) {
    return this.campanhas.editar(id, corpo(body), usuario(req));
  }
  @Post(':id/previa') previa(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: RequisicaoComUsuario,
  ) {
    return this.campanhas.previa(id, corpo(body), usuario(req));
  }
  @Post(':id/preparar') preparar(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: RequisicaoComUsuario,
  ) {
    return this.campanhas.preparar(id, corpo(body), usuario(req));
  }
  @Post(':id/iniciar') iniciar(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: RequisicaoComUsuario,
  ) {
    return this.campanhas.transicao(id, 'iniciar', corpo(body), usuario(req));
  }
  @Post(':id/pausar') pausar(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: RequisicaoComUsuario,
  ) {
    return this.campanhas.transicao(id, 'pausar', corpo(body), usuario(req));
  }
  @Post(':id/retomar') retomar(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: RequisicaoComUsuario,
  ) {
    return this.campanhas.transicao(id, 'retomar', corpo(body), usuario(req));
  }
  @Post(':id/cancelar') cancelar(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: RequisicaoComUsuario,
  ) {
    return this.campanhas.transicao(id, 'cancelar', corpo(body), usuario(req));
  }
  @Get(':id/resultados') resultados(
    @Param('id') id: string,
    @Query() query: Record<string, unknown>,
    @Req() req: RequisicaoComUsuario,
  ) {
    return this.campanhas.resultados(id, query, usuario(req));
  }
  @Get(':id/auditoria') auditoria(@Param('id') id: string, @Req() req: RequisicaoComUsuario) {
    return this.campanhas.auditoria(id, usuario(req));
  }
  /** Envio manual: "Enviei" (enviado: true) ou "Não enviei" (enviado: false). */
  @Post(':id/destinatarios/:destinatarioId/confirmar') confirmar(
    @Param('id') id: string,
    @Param('destinatarioId') destinatarioId: string,
    @Body() body: Record<string, unknown>,
    @Req() req: RequisicaoComUsuario,
  ) {
    return this.campanhas.confirmarManual(id, destinatarioId, corpo(body), usuario(req));
  }
  /** Inclui um contato que ficou de fora por telefone repetido ou que ficou apto depois. */
  @Post(':id/destinatarios/incluir') incluir(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: RequisicaoComUsuario,
  ) {
    return this.campanhas.incluir(id, corpo(body), usuario(req));
  }
  /** Modo manual: libera telefone e texto para abrir o WhatsApp Web deste destinatário. */
  @Post(':id/destinatarios/:destinatarioId/whatsapp-manual') abrirManual(
    @Param('id') id: string,
    @Param('destinatarioId') destinatarioId: string,
    @Req() req: RequisicaoComUsuario,
  ) {
    return this.campanhas.abrirManual(id, destinatarioId, usuario(req));
  }
}
function usuario(req: RequisicaoComUsuario): UsuarioSessao {
  if (!req.usuario?.id) falha('Entre com seu usuário.', 'SESSAO_AUSENTE', 401);
  return req.usuario as UsuarioSessao;
}
function corpo(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    falha('Envie os campos da campanha.');
  return body as Record<string, unknown>;
}
