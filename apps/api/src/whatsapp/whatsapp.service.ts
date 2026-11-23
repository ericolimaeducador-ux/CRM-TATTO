import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  type OnModuleInit,
  type OnModuleDestroy,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { hmacDocumento } from '../seguranca/cifra';
import { configWhatsApp } from './whatsapp.config';
import type {
  BloqueioWhatsApp,
  ControleWhatsApp,
  EstadoWhatsApp,
  ReciboWhatsApp,
  TrabalhoWhatsApp,
} from './whatsapp.schema';

interface LeadWhatsApp {
  _id: Types.ObjectId;
  criadoEm?: Date;
  status?: string;
  fundidoEm?: unknown;
  telefones?: { e164?: string; principal?: boolean; whatsapp?: boolean }[];
  lgpd?: {
    contatoComercial?: string;
    revogadoEm?: Date;
    eliminadoEm?: Date;
    consentimentos?: {
      finalidade?: string;
      revogadoEm?: Date;
      versaoTermo?: string;
      hashTexto?: string;
    }[];
  };
}
const DIA = 86_400_000;
const ESTADOS_ABERTOS: EstadoWhatsApp[] = ['aguardando', 'pendente'];
const MAX_TENTATIVAS = 5;
const JANELA_MS = DIA;

@Injectable()
export class WhatsAppService implements OnModuleInit, OnModuleDestroy {
  fetchImpl: typeof fetch = fetch;
  private timer?: ReturnType<typeof setTimeout>;
  private cicloAtual?: Promise<void>;
  private encerrando = false;

  constructor(
    @InjectConnection() private readonly conexao: Connection,
    @InjectModel('WhatsAppTrabalho') private readonly fila: Model<TrabalhoWhatsApp>,
    @InjectModel('WhatsAppControle') private readonly controles: Model<ControleWhatsApp>,
    @InjectModel('WhatsAppBloqueio') private readonly bloqueios: Model<BloqueioWhatsApp>,
    @InjectModel('WhatsAppRecibo') private readonly recibos: Model<ReciboWhatsApp>,
  ) {}

  async onModuleInit(): Promise<void> {
    await Promise.all([
      this.fila.init(),
      this.controles.init(),
      this.bloqueios.init(),
      this.recibos.init(),
    ]);
    await this.baseline();
    if (process.env.NODE_ENV !== 'test') this.agendar();
  }

  async onModuleDestroy(): Promise<void> {
    this.encerrando = true;
    if (this.timer) clearTimeout(this.timer);
    await this.cicloAtual;
  }

  private agendar(): void {
    if (this.encerrando) return;
    this.timer = setTimeout(() => {
      void this.executarCiclo()
        .catch(() => {
          // Nunca registrar corpo de requisição, telefone ou token.
          console.error(JSON.stringify({ nivel: 'ERROR', evento: 'whatsapp_ciclo_falhou' }));
        })
        .finally(() => this.agendar());
    }, 5000);
    this.timer.unref();
  }

  /** Entrada determinística para QA; a trava também impede sobreposição do timer. */
  executarCiclo(): Promise<void> {
    if (this.cicloAtual) return this.cicloAtual;
    if (this.encerrando) return Promise.resolve();
    this.cicloAtual = this.ciclo().finally(() => {
      this.cicloAtual = undefined;
    });
    return this.cicloAtual;
  }

  private async baseline(): Promise<ControleWhatsApp> {
    try {
      return await this.controles
        .findOneAndUpdate(
          { _id: 'boas_vindas_v1' },
          { $setOnInsert: { instaladoEm: new Date() } },
          { upsert: true, new: true },
        )
        .lean<ControleWhatsApp>()
        .orFail();
    } catch (erro) {
      if (!duplicado(erro)) throw erro;
      return this.controles.findById('boas_vindas_v1').lean<ControleWhatsApp>().orFail();
    }
  }

  private async ciclo(): Promise<void> {
    const agora = new Date();
    const controle = await this.baseline();
    // Consulta incremental por janela e anti-join; não percorre nem dispara a base histórica.
    const desde = new Date(Math.max(controle.instaladoEm.getTime(), agora.getTime() - JANELA_MS));
    const novos = await this.conexao
      .collection<LeadWhatsApp>('contatos')
      .aggregate<LeadWhatsApp>([
        {
          $match: {
            criadoEm: { $gte: desde, $lte: agora },
            status: { $in: ['rascunho', 'capturado', 'qualificado'] },
            fundidoEm: null,
            'lgpd.eliminadoEm': null,
          },
        },
        { $sort: { criadoEm: 1, _id: 1 } },
        {
          $lookup: {
            from: 'whatsapp_fila',
            localField: '_id',
            foreignField: 'contatoId',
            as: 'trabalho',
          },
        },
        { $match: { 'trabalho.0': { $exists: false } } },
        { $limit: 100 },
        { $project: { _id: 1, criadoEm: 1 } },
      ])
      .toArray();
    for (const lead of novos) {
      if (!lead.criadoEm) continue;
      try {
        await this.fila.updateOne(
          { chave: `boas_vindas_v1:${lead._id}` },
          {
            $setOnInsert: {
              contatoId: lead._id,
              estado: 'aguardando',
              motivo: 'aguardando_ativacao',
              tentativas: 0,
              criadoEm: agora,
              expiraEm: new Date(lead.criadoEm.getTime() + JANELA_MS),
              proximaTentativaEm: agora,
              atualizadoEm: agora,
              eventos: [],
            },
          },
          { upsert: true },
        );
      } catch (erro) {
        if (!duplicado(erro)) throw erro;
      }
    }
    // Uma reserva perdida pode ter feito POST antes do processo cair: não reenviar cegamente.
    await this.fila.updateMany(
      { estado: 'processando', reservaAte: { $lte: agora } },
      {
        $set: { estado: 'incerto', motivo: 'reserva_expirada_verificar_meta', atualizadoEm: agora },
        $push: { eventos: { $each: [{ estado: 'incerto', em: agora }], $slice: -30 } },
      },
    );
    await this.fila.updateMany(
      { estado: { $in: ESTADOS_ABERTOS }, expiraEm: { $lte: agora } },
      {
        $set: { estado: 'expirado', motivo: 'janela_24h_encerrada', atualizadoEm: agora },
      },
    );
    // OFF e configuração incompleta não consomem tentativas nem fazem HTTP.
    const cfg = configWhatsApp();
    if (!cfg.ativo || !cfg.completo) return;
    for (let i = 0; i < 10 && !this.encerrando; i += 1) {
      const reservaId = randomUUID();
      const trabalho = await this.fila
        .findOneAndUpdate(
          {
            estado: { $in: ESTADOS_ABERTOS },
            expiraEm: { $gt: new Date() },
            proximaTentativaEm: { $lte: new Date() },
            tentativas: { $lt: MAX_TENTATIVAS },
          },
          {
            $set: {
              estado: 'processando',
              reservaId,
              reservaAte: new Date(Date.now() + 60_000),
              atualizadoEm: new Date(),
            },
          },
          { new: true, sort: { proximaTentativaEm: 1, _id: 1 } },
        )
        .lean<TrabalhoWhatsApp | null>();
      if (!trabalho) break;
      await this.enviar(trabalho);
    }
  }

  private async enviar(trabalho: TrabalhoWhatsApp): Promise<void> {
    const lead = await this.conexao
      .collection<LeadWhatsApp>('contatos')
      .findOne({ _id: trabalho.contatoId });
    const agora = new Date();
    if (
      !lead ||
      lead.fundidoEm ||
      lead.status === 'descartado' ||
      lead.lgpd?.revogadoEm ||
      lead.lgpd?.eliminadoEm
    ) {
      await this.finalizar(trabalho, 'cancelado', 'contato_indisponivel');
      return;
    }
    const lgpd = lead.lgpd;
    if (
      lgpd?.contatoComercial !== 'concedido' ||
      !lgpd.consentimentos?.some(
        (c) =>
          c.finalidade === 'contato_comercial' && !c.revogadoEm && c.versaoTermo && c.hashTexto,
      )
    ) {
      await this.aguardar(trabalho, 'sem_autorizacao');
      return;
    }
    const telefones = [...(lead.telefones ?? [])].sort(
      (a, b) => Number(Boolean(b.principal)) - Number(Boolean(a.principal)),
    );
    const telefone = telefones.find(
      (t) => t.whatsapp !== false && /^\+[1-9]\d{7,14}$/.test(t.e164 ?? ''),
    )?.e164;
    if (!telefone) {
      await this.aguardar(trabalho, 'sem_telefone_valido');
      return;
    }
    const telefoneHash = hmacDocumento(`whatsapp:${telefone.replace('+', '')}`);
    if (await this.bloqueios.exists({ telefoneHash })) {
      await this.finalizar(trabalho, 'cancelado', 'destinatario_solicitou_parada');
      return;
    }
    // Releitura da chave de desligamento imediatamente antes da chamada externa.
    const cfg = configWhatsApp();
    if (!cfg.ativo || !cfg.completo || this.encerrando) {
      await this.aguardar(trabalho, 'aguardando_ativacao');
      return;
    }
    if (trabalho.expiraEm.getTime() <= Date.now()) {
      await this.finalizar(trabalho, 'expirado', 'janela_24h_encerrada');
      return;
    }
    const tentativa = trabalho.tentativas + 1;
    const reservado = await this.fila.updateOne(
      { ...this.reserva(trabalho), reservaAte: { $gt: new Date() } },
      {
        $inc: { tentativas: 1 },
        $set: {
          telefoneHash,
          template: cfg.template,
          idioma: cfg.idioma,
          atualizadoEm: agora,
        },
      },
    );
    if (reservado.matchedCount !== 1) return;
    if (!configWhatsApp().ativo || this.encerrando) {
      await this.aguardar(trabalho, 'aguardando_ativacao');
      return;
    }
    try {
      const resposta = await this.fetchImpl(
        `https://graph.facebook.com/${cfg.versao}/${cfg.numeroId}/messages`,
        {
          method: 'POST',
          redirect: 'error',
          headers: { authorization: `Bearer ${cfg.token}`, 'content-type': 'application/json' },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: telefone.slice(1),
            type: 'template',
            template: { name: cfg.template, language: { code: cfg.idioma } },
          }),
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (resposta.status === 429) {
        await this.reagendar(trabalho, tentativa, resposta.headers.get('retry-after'));
        return;
      }
      if (resposta.status >= 500 || resposta.status === 408) {
        await this.finalizar(trabalho, 'incerto', `http_${resposta.status}_verificar_meta`);
        return;
      }
      if (!resposta.ok) {
        await this.finalizar(trabalho, 'falha', `http_${resposta.status}`);
        return;
      }
      const payload = (await resposta.json()) as { messages?: { id?: unknown }[] };
      const mensagemId = payload.messages?.[0]?.id;
      if (
        typeof mensagemId !== 'string' ||
        !mensagemId.startsWith('wamid.') ||
        mensagemId.length > 500
      ) {
        await this.finalizar(trabalho, 'incerto', 'resposta_sem_id_verificar_meta');
        return;
      }
      await this.fila.updateOne(this.reserva(trabalho), {
        $set: { estado: 'aceito', motivo: '', mensagemId, atualizadoEm: new Date() },
        $unset: { reservaAte: '', reservaId: '' },
        $push: { eventos: { $each: [{ estado: 'aceito', em: new Date() }], $slice: -30 } },
      });
      await this.aplicarRecibo(mensagemId);
    } catch {
      await this.finalizar(trabalho, 'incerto', 'falha_ambigua_verificar_meta');
    }
  }

  private reserva(trabalho: TrabalhoWhatsApp) {
    return { _id: trabalho._id, estado: 'processando', reservaId: trabalho.reservaId };
  }

  private async finalizar(
    trabalho: TrabalhoWhatsApp,
    estado: EstadoWhatsApp,
    motivo: string,
  ): Promise<void> {
    await this.fila.updateOne(this.reserva(trabalho), {
      $set: { estado, motivo, atualizadoEm: new Date() },
      $unset: { reservaAte: '', reservaId: '' },
      $push: { eventos: { $each: [{ estado, em: new Date() }], $slice: -30 } },
    });
  }

  private async aguardar(trabalho: TrabalhoWhatsApp, motivo: string): Promise<void> {
    await this.fila.updateOne(this.reserva(trabalho), {
      $set: {
        estado: 'aguardando',
        motivo,
        proximaTentativaEm: new Date(Date.now() + 60_000),
        atualizadoEm: new Date(),
      },
      $unset: { reservaAte: '', reservaId: '' },
    });
  }

  private async reagendar(
    trabalho: TrabalhoWhatsApp,
    tentativa: number,
    retryAfter: string | null,
  ): Promise<void> {
    if (tentativa >= MAX_TENTATIVAS) {
      await this.finalizar(trabalho, 'falha', 'limite_tentativas');
      return;
    }
    const agora = Date.now();
    const backoff = Math.min(3_600_000, 30_000 * 2 ** (tentativa - 1));
    const valor = retryAfter?.trim() ?? '';
    const prazoServidor = /^\d+$/.test(valor) ? agora + Number(valor) * 1000 : Date.parse(valor);
    const proxima = Math.max(agora + backoff, Number.isNaN(prazoServidor) ? agora : prazoServidor);
    // Retry-After é um limite mínimo, mesmo quando excede o teto do nosso backoff.
    // Se o servidor só aceita nova tentativa fora da janela, encerre sem agendá-la.
    if (proxima >= trabalho.expiraEm.getTime()) {
      await this.finalizar(trabalho, 'expirado', 'retentativa_fora_janela');
      return;
    }
    await this.fila.updateOne(this.reserva(trabalho), {
      $set: {
        estado: 'pendente',
        motivo: 'http_429',
        proximaTentativaEm: new Date(proxima),
        atualizadoEm: new Date(),
      },
      $unset: { reservaAte: '', reservaId: '' },
      $push: {
        eventos: { $each: [{ estado: 'pendente', em: new Date(), codigo: '429' }], $slice: -30 },
      },
    });
  }

  async status(usuarioId: string) {
    const cfg = configWhatsApp();
    const [controle, grupos] = await Promise.all([
      this.controles.findById('boas_vindas_v1').lean<ControleWhatsApp | null>(),
      this.fila.aggregate<{ _id: string; quantidade: number }>([
        { $group: { _id: '$estado', quantidade: { $sum: 1 } } },
      ]),
    ]);
    await this.conexao.collection('acessos_dados').insertOne({
      usuario: new Types.ObjectId(usuarioId),
      acao: 'whatsapp_status',
      em: new Date(),
    });
    return {
      envioAtivo: cfg.ativo,
      configuracaoCompleta: cfg.completo,
      modo: !cfg.ativo ? 'desativado' : cfg.completo ? 'pronto' : 'configuracao_pendente',
      instaladoEm: controle?.instaladoEm ?? null,
      janelaHoras: 24,
      maxTentativas: MAX_TENTATIVAS,
      fila: Object.fromEntries(grupos.map((g) => [g._id, g.quantidade])),
    };
  }

  verificarWebhook(query: Record<string, unknown>): string {
    const cfg = configWhatsApp();
    if (
      query['hub.mode'] !== 'subscribe' ||
      cfg.verifyToken.length < 16 ||
      !iguais(query['hub.verify_token'], cfg.verifyToken)
    )
      throw new ForbiddenException('Verificação do webhook recusada.');
    const desafio = query['hub.challenge'];
    if (typeof desafio !== 'string' || !/^\d{1,200}$/.test(desafio))
      throw new BadRequestException('Desafio inválido.');
    return desafio;
  }

  async receberWebhook(raw: Buffer | undefined, assinatura: string | undefined): Promise<void> {
    const cfg = configWhatsApp();
    if (
      !raw ||
      raw.length > 100_000 ||
      cfg.appSecret.length < 16 ||
      !/^sha256=[a-f\d]{64}$/i.test(assinatura ?? '')
    )
      throw new ForbiddenException('Assinatura do webhook recusada.');
    const esperado = `sha256=${createHmac('sha256', cfg.appSecret).update(raw).digest('hex')}`;
    if (!iguais(assinatura, esperado))
      throw new ForbiddenException('Assinatura do webhook recusada.');
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(raw.toString('utf8')) as Record<string, unknown>;
    } catch {
      throw new BadRequestException('JSON inválido.');
    }
    if (payload?.object !== 'whatsapp_business_account' || !Array.isArray(payload.entry)) return;
    for (const entry of payload.entry.slice(0, 100)) {
      const e = objeto(entry);
      for (const change of lista(e.changes).slice(0, 100)) {
        const c = objeto(change);
        const v = objeto(c.value);
        if (
          c.field !== 'messages' ||
          objeto(v.metadata).phone_number_id !== cfg.numeroId ||
          !cfg.numeroId
        )
          continue;
        // Registrar opt-out primeiro, antes de tratar status de mensagens.
        for (const mensagem of lista(v.messages).slice(0, 100)) {
          const m = objeto(mensagem);
          const remetente = m.from;
          const timestamp =
            typeof m.timestamp === 'string' && /^\d{1,12}$/.test(m.timestamp)
              ? Number(m.timestamp) * 1000
              : NaN;
          // Campanhas só precisam saber que houve resposta: nenhum corpo de conversa é guardado.
          if (
            typeof remetente === 'string' &&
            /^[1-9]\d{7,14}$/.test(remetente) &&
            Number.isFinite(timestamp)
          ) {
            const em = new Date(timestamp);
            if (Math.abs(em.getTime() - Date.now()) <= 30 * DIA) {
              const telefoneHash = hmacDocumento(`whatsapp:${remetente}`);
              const chave = hmacDocumento(`resposta:${telefoneHash}:${String(m.id ?? timestamp)}`);
              await this.conexao
                .db!.collection('whatsapp_respostas')
                .updateOne(
                  { _id: chave as never },
                  { $setOnInsert: { telefoneHash, em, recebidoEm: new Date() } },
                  { upsert: true },
                );
            }
          }
          const texto = objeto(m.text).body;
          if (typeof texto !== 'string' || !/^(sair|parar|stop|cancelar)$/i.test(texto.trim()))
            continue;
          const de = m.from;
          if (typeof de !== 'string' || !/^[1-9]\d{7,14}$/.test(de)) continue;
          const telefoneHash = hmacDocumento(`whatsapp:${de}`);
          await this.bloqueios.updateOne(
            { telefoneHash },
            { $setOnInsert: { em: new Date() } },
            { upsert: true },
          );
          await this.fila.updateMany(
            { telefoneHash, estado: { $in: ESTADOS_ABERTOS } },
            {
              $set: {
                estado: 'cancelado',
                motivo: 'destinatario_solicitou_parada',
                atualizadoEm: new Date(),
              },
            },
          );
        }
        for (const status of lista(v.statuses).slice(0, 100))
          await this.registrarRecibo(objeto(status));
      }
    }
  }

  private async registrarRecibo(status: Record<string, unknown>): Promise<void> {
    const mensagemId = status.id;
    if (
      typeof mensagemId !== 'string' ||
      !mensagemId.startsWith('wamid.') ||
      mensagemId.length > 500
    )
      return;
    const campo = (
      { sent: 'enviado', delivered: 'entregue', read: 'lido', failed: 'falhou' } as Record<
        string,
        string
      >
    )[String(status.status)];
    if (!campo) return;
    const erro = objeto(lista(status.errors)[0]);
    const codigo = typeof erro.code === 'number' ? String(erro.code) : '';
    try {
      await this.recibos.updateOne(
        { mensagemId },
        { $set: { [campo]: true, atualizadoEm: new Date(), ...(codigo ? { codigo } : {}) } },
        { upsert: true },
      );
    } catch (erroMongo) {
      if (!duplicado(erroMongo)) throw erroMongo;
      await this.recibos.updateOne(
        { mensagemId },
        { $set: { [campo]: true, atualizadoEm: new Date() } },
      );
    }
    await this.aplicarRecibo(mensagemId);
  }

  private async aplicarRecibo(mensagemId: string): Promise<void> {
    const recibo = await this.recibos.findOne({ mensagemId }).lean<ReciboWhatsApp | null>();
    if (!recibo) return;
    const [estado, nivel] = recibo.lido
      ? ['lido', 4]
      : recibo.entregue
        ? ['entregue', 3]
        : recibo.falhou
          ? ['falha', 2]
          : ['enviado', 1];
    await this.fila.updateOne(
      { mensagemId, nivelRecibo: { $lt: nivel } },
      {
        $set: {
          estado,
          nivelRecibo: nivel,
          motivo: estado === 'falha' ? `meta_${recibo.codigo || 'falha'}` : '',
          atualizadoEm: new Date(),
        },
        $push: {
          eventos: {
            $each: [
              { estado, em: new Date(), ...(recibo.codigo ? { codigo: recibo.codigo } : {}) },
            ],
            $slice: -30,
          },
        },
      },
    );
  }
}

function iguais(a: unknown, b: string): boolean {
  if (typeof a !== 'string' || a.length > 4096) return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
function duplicado(erro: unknown): boolean {
  return !!erro && typeof erro === 'object' && 'code' in erro && erro.code === 11000;
}
function objeto(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === 'object' && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : {};
}
function lista(valor: unknown): unknown[] {
  return Array.isArray(valor) ? valor : [];
}
