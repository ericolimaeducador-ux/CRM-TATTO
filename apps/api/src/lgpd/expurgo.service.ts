import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { UsuarioSessao } from '../contatos/sessao.middleware';
import { ConsentimentoService } from './consentimento.service';
import {
  deveExpirarPorInatividade,
  devePurgarContato,
  deveSinalizarRascunho,
  diasDePurgaRevogacao,
} from './retencao';

const SISTEMA: UsuarioSessao = {
  id: '000000000000000000000001',
  papel: 'admin',
  nome: 'expurgo',
  stepUp: true,
};

const DIA_MS = 24 * 60 * 60 * 1000;

export function retencaoNaSubida(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV !== 'test';
}

export function relogioDeRetencaoAtivo(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NODE_ENV === 'test') return false;
  return env.RETENCAO_TIMER !== '0';
}

interface ContatoJob {
  _id: unknown;
  status?: string;
  alteradoEm?: Date;
  lgpd?: { revogadoEm?: Date; eliminadoEm?: Date | null };
}

export interface ResultadoExpurgo {
  inatividade: number;
  revogacao: number;
  rascunhos: number;
  removidos: number;
}

@Injectable()
export class ExpurgoService implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    @InjectModel('Contato') private readonly contatos: Model<ContatoJob>,
    private readonly consentimento: ConsentimentoService,
  ) {}

  onModuleInit(): void {
    if (retencaoNaSubida()) void this.rodar().catch(() => undefined);
    if (!relogioDeRetencaoAtivo()) return;
    this.timer = setInterval(() => void this.rodar().catch(() => undefined), 60 * 60 * 1000);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async rodar(agora = new Date()): Promise<ResultadoExpurgo> {
    const resultado: ResultadoExpurgo = {
      inatividade: 0,
      revogacao: 0,
      rascunhos: 0,
      removidos: 0,
    };
    const vivos = await this.contatos
      .find({ 'lgpd.eliminadoEm': null })
      .select('_id status alteradoEm lgpd')
      .limit(500)
      .lean();
    for (const item of vivos) {
      if (deveExpirarPorInatividade(item.alteradoEm, agora)) {
        await this.consentimento.eliminar(String(item._id), SISTEMA);
        resultado.inatividade += 1;
        continue;
      }
      const revogadoEm = item.lgpd?.revogadoEm ? new Date(item.lgpd.revogadoEm) : undefined;
      if (devePurgarContato(revogadoEm, agora)) {
        await this.consentimento.eliminar(String(item._id), SISTEMA);
        resultado.revogacao += 1;
        continue;
      }
      if (deveSinalizarRascunho(item.status ?? '', item.alteradoEm, agora)) {
        await this.consentimento.eliminar(String(item._id), SISTEMA);
        resultado.rascunhos += 1;
      }
    }
    const limite = new Date(agora.getTime() - diasDePurgaRevogacao() * DIA_MS);
    const velhos = await this.contatos
      .find({ 'lgpd.eliminadoEm': { $ne: null, $lte: limite } })
      .select('_id')
      .limit(500)
      .lean();
    if (velhos.length > 0) {
      await this.contatos.deleteMany({ _id: { $in: velhos.map((item) => item._id) } });
      resultado.removidos = velhos.length;
    }
    return resultado;
  }
}
