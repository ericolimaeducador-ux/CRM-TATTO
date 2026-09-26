import { Body, Controller, Get, HttpCode, Param, Post, Req } from '@nestjs/common';
import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';
import { PERFIL_PERMISSOES } from '../auth/perfil-permissoes';
import { Papel } from '../auth/papeis.decorator';
import { TotpService } from '../auth/totp.service';
import { RespostaComErro } from '../contatos/erros-http';
import type { RequisicaoComUsuario, UsuarioSessao } from '../contatos/sessao.middleware';
import { DedupService } from './dedup.service';
import { MergeService } from './merge.service';

class MergeDto {
  @IsOptional()
  @IsString()
  absorvidoId?: string;

  @IsOptional()
  @IsObject()
  valoresEscolhidos?: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  confirmacao?: boolean;

  @IsOptional()
  @IsString()
  codigoTotp?: string;
}

@Controller('v1')
export class QualidadeController {
  constructor(
    private readonly dedup: DedupService,
    private readonly merge: MergeService,
    private readonly totp: TotpService,
  ) {}

  @Get('duplicatas')
  @Papel('gestor', 'admin')
  listar(@Req() req: RequisicaoComUsuario) {
    return this.dedup.listar(exigir(req));
  }

  @Get('contatos/:id/duplicatas')
  @Papel('gestor', 'admin')
  deUm(@Param('id') id: string, @Req() req: RequisicaoComUsuario) {
    return this.dedup.deUm(id, exigir(req));
  }

  @Post('contatos/:id/merge')
  @HttpCode(200)
  @Papel(...PERFIL_PERMISSOES.fundir)
  async fundir(@Param('id') id: string, @Body() corpo: MergeDto, @Req() req: RequisicaoComUsuario) {
    const usuario = exigir(req);
    await liberarPasso(this.totp, usuario, corpo.codigoTotp);
    return this.merge.fundir(
      id,
      corpo.absorvidoId,
      corpo.valoresEscolhidos,
      corpo.confirmacao,
      usuario,
    );
  }

  @Post('contatos/:id/recuperar')
  @HttpCode(200)
  @Papel(...PERFIL_PERMISSOES.fundir)
  async recuperar(
    @Param('id') id: string,
    @Body() corpo: { codigoTotp?: string },
    @Req() req: RequisicaoComUsuario,
  ) {
    const usuario = exigir(req);
    await liberarPasso(this.totp, usuario, corpo?.codigoTotp);
    return this.merge.recuperar(id, usuario);
  }
}

async function liberarPasso(
  totp: TotpService,
  usuario: UsuarioSessao,
  codigo: string | undefined,
): Promise<void> {
  if (codigo?.trim()) {
    const veredito = await totp.confirmar(usuario.id, codigo);
    if (!veredito.aceito) throw new RespostaComErro(403, veredito.codigo, veredito.mensagem, null);
    return;
  }
  if (usuario.stepUp === true) return;
  throw new RespostaComErro(
    403,
    'STEP_UP_NECESSARIO',
    'A fusão pede o código de 6 dígitos do autenticador. Nada foi alterado.',
    null,
  );
}

function exigir(req: RequisicaoComUsuario): UsuarioSessao {
  if (!req.usuario?.id) {
    throw new RespostaComErro(
      403,
      'PAPEL_INSUFICIENTE',
      'A sessão não identificou quem decide a fusão. Entre de novo. Nada foi alterado.',
      null,
    );
  }
  return req.usuario;
}
