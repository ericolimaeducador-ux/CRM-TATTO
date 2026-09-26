import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { UsuarioSessao } from '../contatos/sessao.middleware';
import { ConsentimentoService } from './consentimento.service';
import { deveExpirarPorInatividade } from './retencao';

const SISTEMA: UsuarioSessao = {
  id: '000000000000000000000001',
  papel: 'admin',
  nome: 'expurgo',
  stepUp: true,
};

@Injectable()
export class ExpurgoService implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    @InjectModel('Contato')
    private readonly contatos: Model<{
      _id: unknown;
      alteradoEm?: Date;
      lgpd?: { eliminadoEm?: Date };
    }>,
    private readonly consentimento: ConsentimentoService,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.rodar().catch(() => undefined), 60 * 60 * 1000);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async rodar(agora = new Date()): Promise<number> {
    const candidatos = await this.contatos
      .find({ 'lgpd.eliminadoEm': null })
      .select('_id alteradoEm')
      .limit(500)
      .lean();
    let apagados = 0;
    for (const item of candidatos) {
      if (!deveExpirarPorInatividade(item.alteradoEm, agora)) continue;
      await this.consentimento.eliminar(String(item._id), SISTEMA);
      apagados += 1;
    }
    return apagados;
  }
}
