import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { PERFIL_PERMISSOES } from '../auth/perfil-permissoes';
import { Papel, Publico } from '../auth/papeis.decorator';
import { RespostaComErro } from '../contatos/erros-http';
import type { RequisicaoComUsuario, UsuarioSessao } from '../contatos/sessao.middleware';
import { AutocadastroDto, ConsentimentoDto } from './autocadastro.dto';
import { AutocadastroService } from './autocadastro.service';
import { ConsentimentoService } from './consentimento.service';
import { descreverCaptcha } from './captcha';
import { textoDoTermo } from './texto-termo';

@Controller('v1/publico')
@Publico()
export class PublicoController {
  constructor(private readonly autocadastro: AutocadastroService) {}

  @Get('captcha')
  captcha() {
    return { dados: descreverCaptcha(), avisos: [], erros: [] };
  }

  @Get('termo/atual')
  atual() {
    return { dados: textoDoTermo(), avisos: [], erros: [] };
  }

  @Get('termo/:versao')
  versao(@Param('versao') versao: string) {
    const texto = textoDoTermo();
    if (versao !== texto.versao) {
      throw new RespostaComErro(
        404,
        'VERSAO_AUSENTE',
        'Essa versão do termo não está publicada. Nada foi gravado.',
        null,
      );
    }
    return { dados: texto, avisos: [], erros: [] };
  }

  @Post('autocadastro')
  concluir(@Body() corpo: AutocadastroDto, @Req() req: Request) {
    return this.autocadastro.concluir(corpo, req.ip || req.socket.remoteAddress || 'sem-ip');
  }
}

@Controller('v1')
export class QrController {
  constructor(private readonly autocadastro: AutocadastroService) {}

  @Post('qr')
  @Papel(...PERFIL_PERMISSOES.criar_contato)
  async emitir(@Req() req: RequisicaoComUsuario) {
    const emitido = await this.autocadastro.emitir(exigirUsuario(req));
    return { dados: emitido, avisos: [], erros: [] };
  }

  @Post('qr/:token/revogar')
  @Papel(...PERFIL_PERMISSOES.criar_contato)
  async revogar(@Param('token') token: string, @Req() req: RequisicaoComUsuario) {
    const dados = await this.autocadastro.revogar(token, exigirUsuario(req));
    return { dados, avisos: [], erros: [] };
  }
}

@Controller('v1/contatos')
export class ConsentimentoController {
  constructor(private readonly consentimento: ConsentimentoService) {}

  @Post(':id/consentimento')
  @Papel(...PERFIL_PERMISSOES.editar_contato)
  registrar(
    @Param('id') id: string,
    @Body() corpo: ConsentimentoDto,
    @Req() req: RequisicaoComUsuario,
  ) {
    return this.consentimento.registrar(
      id,
      exigirUsuario(req),
      corpo.contatoComercial,
      corpo.emDispositivo,
      corpo.envioErp,
    );
  }

  @Post(':id/revogacao')
  @Papel('gestor', 'admin')
  revogar(
    @Param('id') id: string,
    @Body() corpo: { confirmar?: boolean },
    @Req() req: RequisicaoComUsuario,
  ) {
    if (corpo?.confirmar !== true) {
      throw new RespostaComErro(
        422,
        'CONFIRMACAO_AUSENTE',
        'Confirme a revogação. Nada foi alterado.',
        null,
      );
    }
    return this.consentimento.revogar(id, exigirUsuario(req));
  }

  @Post(':id/eliminacao')
  @Papel('gestor', 'admin')
  eliminar(
    @Param('id') id: string,
    @Body() corpo: { confirmacao?: string },
    @Req() req: RequisicaoComUsuario,
  ) {
    return this.consentimento.eliminar(id, exigirUsuario(req), corpo?.confirmacao ?? '');
  }

  @Post(':id/contato-comercial')
  @Papel(...PERFIL_PERMISSOES.editar_contato)
  tentar(@Param('id') id: string, @Req() req: RequisicaoComUsuario) {
    return this.consentimento.tentarContato(id, exigirUsuario(req));
  }
}

function exigirUsuario(req: RequisicaoComUsuario): UsuarioSessao {
  if (!req.usuario?.id) {
    throw new RespostaComErro(
      403,
      'PAPEL_INSUFICIENTE',
      'A sessão não identificou quem está gravando. Nada foi atribuído a um autor fictício.',
      null,
    );
  }
  return req.usuario;
}
