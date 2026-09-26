import { createHash, createHmac } from 'node:crypto';
import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types, type Model } from 'mongoose';
import { aoPromoverCliente, type PromocaoCliente } from '../contatos/promocao-publicada';
import { envioErpLiberado, type LgpdMinimo } from '../lgpd/retencao';

const TETO_MS = 5 * 60 * 1000;

interface Entrega {
  chaveIdempotencia: string;
  contatoId: string;
  versao: number;
  autorId: string;
  hashCorpo: string;
  corpoJson: string;
  status: string;
  tentativas: number;
  ultimoErro: string;
}

@Injectable()
export class WebhookSaidaService implements OnModuleInit, OnModuleDestroy {
  fetchImpl: typeof fetch = fetch;
  private soltar: (() => void) | null = null;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private emCurso = new Set<string>();

  constructor(
    @InjectModel('WebhookSaida') private readonly fila: Model<Entrega>,
    @InjectModel('Contato') private readonly contatos: Model<{ lgpd?: LgpdMinimo }>,
  ) {}

  onModuleInit(): void {
    this.soltar = aoPromoverCliente((evento) => this.enfileirar(evento));
  }

  onModuleDestroy(): void {
    this.soltar?.();
    this.soltar = null;
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
  }

  async enfileirar(evento: PromocaoCliente): Promise<void> {
    const corpoJson = JSON.stringify({
      versaoContrato: 'v1',
      caminho: '/v1/integracao/contatos-promovidos',
      evento: 'contato.promovido',
      contatoId: evento.contatoId,
      versaoContato: evento.versao,
      status: 'cliente',
      autorId: evento.autorId,
      em: evento.em,
    });
    const chave = `${evento.contatoId}:${evento.versao}`;
    try {
      await this.fila.create({
        chaveIdempotencia: chave,
        contatoId: evento.contatoId,
        versao: evento.versao,
        autorId: evento.autorId,
        hashCorpo: createHash('sha256').update(corpoJson).digest('hex'),
        corpoJson,
        status: 'pendente',
        tentativas: 0,
        ultimoErro: '',
        criadoEm: new Date(),
      });
    } catch (erro) {
      if (!chaveDuplicada(erro)) throw erro;
    }
    await this.tentar(chave);
  }

  private async tentar(chave: string): Promise<void> {
    if (this.emCurso.has(chave)) return;
    this.emCurso.add(chave);
    try {
      await this.enviar(chave);
    } finally {
      this.emCurso.delete(chave);
    }
  }

  private async enviar(chave: string): Promise<void> {
    const doc = await this.fila.findOne({ chaveIdempotencia: chave }).lean<Entrega | null>();
    if (
      !doc ||
      doc.status === 'entregue' ||
      doc.status === 'nao_configurado' ||
      doc.status === 'sem_consentimento'
    ) {
      return;
    }
    if (!(await this.temConsentimentoErp(doc.contatoId))) {
      await this.fila.updateOne(
        { chaveIdempotencia: chave },
        { $set: { status: 'sem_consentimento', ultimoErro: 'sem consentimento de envio ao ERP' } },
      );
      this.registrar(doc, 'sem_consentimento');
      return;
    }
    const destino = destinoConfigurado();
    if (!destino) {
      await this.fila.updateOne(
        { chaveIdempotencia: chave },
        { $set: { status: 'nao_configurado', ultimoErro: 'URL ou segredo ausente' } },
      );
      this.registrar(doc, 'nao_configurado');
      return;
    }
    const tentativa = doc.tentativas + 1;
    try {
      const resposta = await this.fetchImpl(destino.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'X-Captura7-Assinatura': assinarCorpo(destino.segredo, doc.corpoJson),
          'X-Captura7-Timestamp': String(Date.now()),
          'X-Captura7-Idempotencia': chave,
        },
        body: doc.corpoJson,
        signal: AbortSignal.timeout(3000),
      });
      if (!resposta.ok) {
        await this.reagendar(doc, tentativa, `HTTP ${resposta.status}`);
        return;
      }
      await this.fila.updateOne(
        { chaveIdempotencia: chave },
        {
          $set: {
            status: 'entregue',
            tentativas: tentativa,
            entregueEm: new Date(),
            ultimoErro: '',
          },
        },
      );
      this.registrar(doc, 'entregue');
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : 'falha de rede';
      await this.reagendar(doc, tentativa, mensagem);
    }
  }

  private async reagendar(doc: Entrega, tentativa: number, erro: string): Promise<void> {
    await this.fila.updateOne(
      { chaveIdempotencia: doc.chaveIdempotencia },
      { $set: { status: 'falha', tentativas: tentativa, ultimoErro: erro.slice(0, 300) } },
    );
    this.registrar(doc, 'falha');
    const espera = Math.min(intervaloBase() * 2 ** Math.max(0, tentativa - 1), TETO_MS);
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      void this.tentar(doc.chaveIdempotencia);
    }, espera);
    this.timers.add(timer);
  }

  private async temConsentimentoErp(contatoId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(contatoId)) return false;
    const contato = await this.contatos.findById(contatoId).lean<{ lgpd?: LgpdMinimo } | null>();
    return envioErpLiberado(contato?.lgpd);
  }

  private registrar(
    doc: Pick<Entrega, 'chaveIdempotencia' | 'hashCorpo' | 'autorId'>,
    status: string,
  ): void {
    console.log(
      JSON.stringify({
        nivel: status === 'falha' ? 'WARN' : 'INFO',
        evento: 'webhook_saida',
        chave: doc.chaveIdempotencia,
        hashCorpo: doc.hashCorpo,
        status,
        autorId: doc.autorId,
        em: new Date().toISOString(),
      }),
    );
  }
}

export function assinarCorpo(segredo: string, corpo: string): string {
  return createHmac('sha256', segredo).update(corpo).digest('hex');
}

function destinoConfigurado(): { url: string; segredo: string } | null {
  const url = process.env.ERP_WEBHOOK_URL?.trim() ?? '';
  const segredo = process.env.ERP_WEBHOOK_SEGREDO?.trim() ?? '';
  if (!url || !segredo) return null;
  if (url.includes('preencha-com') || segredo.includes('preencha-com')) return null;
  return { url, segredo };
}

function intervaloBase(): number {
  const bruto = Number(process.env.ERP_WEBHOOK_INTERVALO_MS ?? 1000);
  if (!Number.isFinite(bruto) || bruto < 1) return 1000;
  return bruto;
}

function chaveDuplicada(erro: unknown): boolean {
  return typeof erro === 'object' && erro !== null && 'code' in erro && erro.code === 11000;
}
