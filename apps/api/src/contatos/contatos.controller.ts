import { Body, Controller, Get, Param, Patch, Post, Query, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PERFIL_PERMISSOES } from '../auth/perfil-permissoes';
import { Papel } from '../auth/papeis.decorator';
import { ContatosService } from './contatos.service';
import { CriarContatoDto, LoteDto, PatchContatoDto, TransicaoDto } from './criar-contato.dto';
import { LoteService } from './lote.service';
import { RespostaComErro } from './erros-http';
import type { RequisicaoComUsuario, UsuarioSessao } from './sessao.middleware';
import { TransicaoService } from './transicao.service';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { ContatoAuditoria } from './schemas/contato-auditoria.schema';

@Controller('v1/contatos')
export class ContatosController {
  constructor(
    private readonly contatos: ContatosService,
    private readonly transicoes: TransicaoService,
    private readonly lote: LoteService,
    @InjectModel('ContatoAuditoria') private readonly auditoria: Model<ContatoAuditoria>,
  ) {}

  @Post()
  @Papel(...PERFIL_PERMISSOES.criar_contato)
  async criar(
    @Body() corpo: CriarContatoDto,
    @Req() req: RequisicaoComUsuario,
    @Res({ passthrough: true }) res: Response,
  ) {
    const resultado = await this.contatos.criar(corpo, exigirUsuario(req));
    res.status(resultado.http);
    return { dados: resultado.dados, avisos: resultado.avisos, erros: [] };
  }

  @Post('lote')
  @Papel(...PERFIL_PERMISSOES.criar_contato)
  async drenar(@Body() corpo: LoteDto, @Req() req: RequisicaoComUsuario) {
    return this.lote.executar(corpo, exigirUsuario(req));
  }

  @Patch(':id')
  @Papel(...PERFIL_PERMISSOES.editar_contato)
  async patch(
    @Param('id') id: string,
    @Body() corpo: PatchContatoDto,
    @Req() req: RequisicaoComUsuario,
  ) {
    const resultado = await this.contatos.patch(
      id,
      corpo.campo,
      corpo.valor,
      corpo.versaoConhecida,
      exigirUsuario(req),
    );
    return { dados: resultado.dados, avisos: resultado.avisos, erros: [] };
  }

  @Post(':id/resolucao')
  @Papel(...PERFIL_PERMISSOES.editar_contato)
  async resolver(
    @Param('id') id: string,
    @Body() corpo: { escolha?: string },
    @Req() req: RequisicaoComUsuario,
  ) {
    const usuario = exigirUsuario(req);
    if (corpo.escolha === 'servidor') {
      return { dados: await this.contatos.limparConflito(id, usuario), avisos: [], erros: [] };
    }
    if (corpo.escolha === 'local') {
      const atual = await this.contatos.obter(id, usuario);
      const conflito = atual.conflito as
        | {
            campo?: string;
            versaoLocal?: { valor?: unknown };
            versaoServidor?: { versao?: number };
          }
        | undefined;
      const valor = conflito?.versaoLocal?.valor;
      if (!conflito?.campo || typeof valor !== 'string') {
        throw new RespostaComErro(
          422,
          'CONFLITO_AUSENTE',
          'Não há escolha pendente neste contato. Nada foi alterado.',
          atual,
        );
      }
      const resultado = await this.contatos.patch(
        id,
        conflito.campo,
        valor,
        conflito.versaoServidor?.versao,
        usuario,
      );
      return { dados: resultado.dados, avisos: resultado.avisos, erros: [] };
    }
    throw new RespostaComErro(
      422,
      'ESCOLHA_INVALIDA',
      'Escolha local ou servidor. Nada foi alterado.',
      null,
    );
  }

  @Post(':id/transicao')
  @Papel(...PERFIL_PERMISSOES.editar_contato)
  async transicao(
    @Param('id') id: string,
    @Body() corpo: TransicaoDto,
    @Req() req: RequisicaoComUsuario,
  ) {
    const resultado = await this.transicoes.executar(
      id,
      corpo.para,
      corpo.motivo,
      exigirUsuario(req),
      corpo.codigoTotp,
    );
    return { dados: resultado.dados, avisos: resultado.avisos, erros: [] };
  }

  @Get('resumo')
  @Papel(...PERFIL_PERMISSOES.ler_contato)
  resumo(@Req() req: RequisicaoComUsuario) {
    return this.contatos.resumo(exigirUsuario(req));
  }

  @Get()
  @Papel(...PERFIL_PERMISSOES.ler_contato)
  listar(
    @Query('cursor') cursor: string | undefined,
    @Query('limite') limite: string | undefined,
    @Query('q') q: string | undefined,
    @Query('status') status: string | undefined,
    @Query('origem') origem: string | undefined,
    @Query('pessoa') pessoa: string | undefined,
    @Query('consentimento') consentimento: string | undefined,
    @Query('desde') desde: string | undefined,
    @Query('ate') ate: string | undefined,
    @Query('ordem') ordem: string | undefined,
    @Req() req: RequisicaoComUsuario,
  ) {
    return this.contatos.listar(exigirUsuario(req), {
      cursor,
      limite,
      q,
      status,
      origem,
      pessoa,
      consentimento,
      desde,
      ate,
      ordem,
    });
  }

  @Get(':id/auditoria')
  @Papel(...PERFIL_PERMISSOES.ler_auditoria)
  async auditoriaDoContato(@Param('id') id: string) {
    const linhas = await this.auditoria
      .find({ contatoId: id })
      .sort({ timestampServidor: -1 })
      .lean();
    return { dados: linhas };
  }

  @Get(':id')
  @Papel(...PERFIL_PERMISSOES.ler_contato)
  async obter(@Param('id') id: string, @Req() req: RequisicaoComUsuario) {
    return { dados: await this.contatos.obter(id, exigirUsuario(req)) };
  }
}

function exigirUsuario(req: RequisicaoComUsuario): UsuarioSessao {
  if (!req.usuario?.id) {
    throw new RespostaComErro(
      403,
      'PAPEL_INSUFICIENTE',
      'A sessão não identificou quem está gravando. Entre de novo e repita. Nada foi atribuído a um autor fictício.',
      null,
    );
  }
  return req.usuario;
}
