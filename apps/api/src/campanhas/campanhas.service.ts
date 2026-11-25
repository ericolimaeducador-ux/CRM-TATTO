import { randomUUID } from 'node:crypto';
import { Injectable, type OnModuleInit, type OnModuleDestroy } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { falha } from '../comercial/comercial.campos';
import type { UsuarioSessao } from '../contatos/sessao.middleware';
import { hmacDocumento } from '../seguranca/cifra';
import { configCampanhas } from './campanhas.config';
import {
  CADENCIA_PADRAO,
  MENSAGEM_INICIAL,
  MODOS_ENVIO,
  type Cadencia,
  type Campanha,
  type ControleCampanha,
  type Destinatario,
  type EstadoCampanha,
  type EstadoDestinatario,
  type LeadCampanha,
  type ModeloCampanha,
  type ModoEnvio,
} from './campanhas.tipos';

const DIA = 86_400_000;
const LEASE = 120_000;
const MAX_PUBLICO = 2000;
const LIMITE_PENDENCIAS = 5000;

@Injectable()
export class CampanhasService implements OnModuleInit, OnModuleDestroy {
  fetchImpl: typeof fetch = fetch;
  agora: () => Date = () => new Date();
  private timer?: ReturnType<typeof setTimeout>;
  private atual?: Promise<void>;
  private encerrando = false;
  constructor(@InjectConnection() private readonly conexao: Connection) {}
  private get campanhas() {
    return this.conexao.db!.collection<Campanha>('whatsapp_campanhas');
  }
  private get fila() {
    return this.conexao.db!.collection<Destinatario>('whatsapp_campanhas_fila');
  }
  private get controles() {
    return this.conexao.db!.collection<ControleCampanha>('whatsapp_campanhas_controle');
  }
  private get contatos() {
    return this.conexao.db!.collection<LeadCampanha>('contatos');
  }

  async onModuleInit() {
    await this.campanhas.createIndex({ criadoEm: -1, _id: -1 });
    // Um destinatário por contato. O mesmo telefone pode entrar duas vezes quando quem
    // cuida da campanha libera o repetido (ADR-025); a prévia continua deduplicando.
    const antigo = (await this.fila.indexes().catch(() => [])).find(
      (i) => i.name === 'campanhaId_1_telefoneHash_1' && i.unique,
    );
    if (antigo) await this.fila.dropIndex('campanhaId_1_telefoneHash_1');
    await this.fila.createIndex({ campanhaId: 1, contatoId: 1 }, { unique: true });
    await this.fila.createIndex({ campanhaId: 1, telefoneHash: 1 });
    await this.fila.createIndex({ estado: 1, proximaTentativaEm: 1 });
    await this.fila.createIndex({ mensagemId: 1 }, { unique: true, sparse: true });
    await this.conexao.db!.collection('whatsapp_respostas').createIndex({ telefoneHash: 1, em: 1 });
    await this.controles.updateOne(
      { _id: 'global' },
      {
        $setOnInsert: {
          reservaAte: new Date(0),
          proximaSaidaEm: new Date(0),
          dia: '',
          diario: 0,
          lote: 0,
        },
      },
      { upsert: true },
    );
    if (process.env.NODE_ENV !== 'test') this.agendar();
  }
  async onModuleDestroy() {
    this.encerrando = true;
    if (this.timer) clearTimeout(this.timer);
    await this.atual;
  }
  private agendar() {
    if (this.encerrando) return;
    this.timer = setTimeout(() => {
      void this.executarCiclo()
        .catch(() => {
          console.error(JSON.stringify({ evento: 'campanhas_ciclo_falhou' }));
        })
        .finally(() => this.agendar());
    }, 5000);
    this.timer.unref();
  }
  configuracao() {
    const c = configCampanhas();
    return {
      registro: {
        envioAtivo: c.ativo,
        configuracaoCompleta: c.completo,
        faltantes: c.faltantes,
        modo: !c.ativo ? 'desativado' : c.completo ? 'pronto' : 'configuracao_pendente',
        limitePublico: MAX_PUBLICO,
        cadenciaPadrao: CADENCIA_PADRAO,
        somenteTextoSemParametros: true,
      },
    };
  }
  async templates() {
    const cfg = configCampanhas();
    if (!/^v\d+\.\d+$/.test(cfg.versao) || !/^\d{5,30}$/.test(cfg.wabaId) || cfg.token.length < 16)
      falha(
        'Configure privadamente WHATSAPP_API_VERSAO, WHATSAPP_WABA_ID e WHATSAPP_ACCESS_TOKEN para consultar os templates. O rascunho pode ser salvo sem isso.',
        'CAMPANHA_CONFIGURACAO',
        422,
      );
    const modelos: ModeloCampanha[] = [];
    let depois = '';
    try {
      // Não seguimos URLs arbitrárias retornadas pela API: somente cursor na origem fixa.
      for (let pagina = 0; pagina < 20; pagina++) {
        const query = new URLSearchParams({
          fields: 'id,name,status,category,language,components',
          limit: '100',
          ...(depois ? { after: depois } : {}),
        });
        const resposta = await this.fetchImpl(
          `https://graph.facebook.com/${cfg.versao}/${cfg.wabaId}/message_templates?${query}`,
          {
            redirect: 'error',
            headers: { authorization: `Bearer ${cfg.token}` },
            signal: AbortSignal.timeout(10_000),
          },
        );
        if (!resposta.ok)
          falha(
            'Não foi possível verificar os templates na Meta. Confira a configuração privada e tente novamente.',
            'TEMPLATE_INDISPONIVEL',
            422,
          );
        const payload = objeto(await resposta.json());
        for (const item of Array.isArray(payload.data) ? payload.data : []) {
          const t = modeloAprovado(item);
          if (t) modelos.push(t);
        }
        const paging = objeto(payload.paging);
        const cursor = objeto(paging.cursors).after;
        if (!paging.next || typeof cursor !== 'string' || cursor.length > 1000) break;
        depois = cursor;
      }
    } catch {
      falha(
        'A Meta não confirmou os templates. Nenhuma mensagem foi enviada. Confira a configuração e tente novamente.',
        'TEMPLATE_INDISPONIVEL',
        422,
      );
    }
    return { registros: modelos };
  }
  async candidatos(query: Record<string, unknown>, usuario: UsuarioSessao) {
    const pagina = inteiro(query.pagina ?? 1, 1, 10000, 'Página');
    const limite = 30;
    const filtro: Record<string, unknown> = { ...carteiraDoPapel(usuario) };
    const busca = texto(query.q ?? '', 100);
    if (busca)
      filtro.nome = { $regex: busca.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    const origem = texto(query.origem ?? '', 80);
    const tag = texto(query.tag ?? '', 100);
    if (origem) filtro['origem.modo'] = origem;
    if (tag) filtro.tags = tag;
    if (query.de || query.ate) {
      const de = query.de ? dataCivil(query.de) : null;
      const ate = query.ate ? new Date(dataCivil(query.ate).getTime() + DIA) : null;
      if (de && ate && ate <= de) falha('O fim deve ser igual ou posterior ao início.');
      filtro.criadoEm = { ...(de ? { $gte: de } : {}), ...(ate ? { $lt: ate } : {}) };
    }
    const [leads, total] = await Promise.all([
      this.contatos
        .find(filtro)
        .sort({ criadoEm: -1, _id: -1 })
        .skip((pagina - 1) * limite)
        .limit(limite)
        .toArray(),
      this.contatos.countDocuments(filtro),
    ]);
    const registros = await Promise.all(
      leads.map(async (lead) => {
        const elegibilidade = await this.elegibilidade(lead);
        return {
          id: lead._id.toString(),
          nome: lead.nome || 'Contato sem nome',
          status: lead.status,
          origem: lead.origem?.modo || '',
          tags: lead.tags ?? [],
          telefoneMascarado: elegibilidade.telefone ? mascarar(elegibilidade.telefone) : '',
          elegivel: !elegibilidade.motivo,
          motivo: elegibilidade.motivo,
        };
      }),
    );
    await this.acesso(usuario, 'campanhas_candidatos', registros.length, {
      filtroHash: hmacDocumento(
        JSON.stringify({ busca, origem, tag, de: query.de ?? '', ate: query.ate ?? '' }),
      ),
    });
    return { registros, total, pagina, limite };
  }
  async pendencias(query: Record<string, unknown>, usuario: UsuarioSessao) {
    const pagina = inteiro(query.pagina ?? 1, 1, 10000, 'Página');
    const limite = 30;
    const motivoPedido = texto(query.motivo ?? '', 60);
    const leads = await this.contatos
      .find(
        {
          status: { $in: ['rascunho', 'capturado', 'qualificado', 'cliente'] },
          ...carteiraDoPapel(usuario),
        },
        {
          projection: {
            nome: 1,
            status: 1,
            criadoEm: 1,
            fundidoEm: 1,
            origem: 1,
            tags: 1,
            telefones: 1,
            lgpd: 1,
            triagem: 1,
          },
        },
      )
      .sort({ criadoEm: -1, _id: -1 })
      .limit(LIMITE_PENDENCIAS + 1)
      .toArray();
    const truncado = leads.length > LIMITE_PENDENCIAS;
    const contagem: Record<string, number> = {};
    const fora: { lead: LeadCampanha; motivo: string }[] = [];
    let elegiveis = 0;
    for (const lead of leads.slice(0, LIMITE_PENDENCIAS)) {
      const { motivo } = await this.elegibilidade(lead);
      if (!motivo) {
        elegiveis += 1;
        continue;
      }
      if (motivo === 'contato_indisponivel') continue;
      contagem[motivo] = (contagem[motivo] ?? 0) + 1;
      if (!motivoPedido || motivoPedido === motivo) fora.push({ lead, motivo });
    }
    const registros = fora
      .slice((pagina - 1) * limite, pagina * limite)
      .map(({ lead, motivo }) => ({
        id: lead._id.toString(),
        nome: lead.nome || 'Contato sem nome',
        status: lead.status,
        origem: lead.origem?.modo || '',
        criadoEm: lead.criadoEm ?? null,
        motivo,
        contatoComercial: lead.lgpd?.contatoComercial || 'pendente',
        telefoneRegistrado: pistaTelefone(lead.telefones),
      }));
    await this.acesso(usuario, 'campanhas_pendencias', registros.length, {
      filtroHash: hmacDocumento(JSON.stringify({ motivo: motivoPedido })),
    });
    return {
      registros,
      total: fora.length,
      pagina,
      limite,
      contagem,
      elegiveis,
      analisados: Math.min(leads.length, LIMITE_PENDENCIAS),
      truncado,
    };
  }
  async listar(query: Record<string, unknown>, usuario: UsuarioSessao) {
    const pagina = inteiro(query.pagina ?? 1, 1, 10000, 'Página');
    // Toda a equipe vê todas as campanhas (ADR-025). Alterar continua com quem criou ou a gestão.
    void usuario;
    const escopo = {};
    const [registros, total] = await Promise.all([
      this.campanhas
        .find(escopo, { projection: { auditoria: 0 } })
        .sort({ criadoEm: -1, _id: -1 })
        .skip((pagina - 1) * 30)
        .limit(30)
        .toArray(),
      this.campanhas.countDocuments(escopo),
    ]);
    return { registros, total, pagina, limite: 30 };
  }
  async criar(body: Record<string, unknown>, usuario: UsuarioSessao) {
    exigirModoDoPapel(usuario, campos(body), 'manual');
    const agora = this.agora();
    const doc: Campanha = {
      _id: new Types.ObjectId(),
      titulo: 'Pós Tattoo Week',
      mensagem: MENSAGEM_INICIAL,
      contatosIds: [],
      template: null,
      cadencia: { ...CADENCIA_PADRAO },
      ...campos(body),
      estado: 'rascunho',
      versao: 1,
      ...(usuario.papel === 'vendedor' ? { modo: 'manual' as const, carteiraDe: usuario.id } : {}),
      criadoPor: usuario.id,
      criadoEm: agora,
      alteradoEm: agora,
      auditoria: [this.evento('criar', usuario.id, 1, Object.keys(campos(body)))],
    };
    await this.campanhas.insertOne(doc);
    return { registro: doc };
  }
  async obter(id: string, usuario: UsuarioSessao) {
    return { registro: await this.ler(id, usuario) };
  }
  async editar(id: string, body: Record<string, unknown>, usuario: UsuarioSessao) {
    const c = await this.lerVersao(id, body, usuario);
    if (c.estado !== 'rascunho')
      falha(
        'Somente rascunhos podem ser editados. O público de uma campanha preparada está congelado.',
        'CAMPANHA_ESTADO',
        409,
      );
    exigirAutoria(c, usuario);
    exigirModoDoPapel(usuario, campos(body), modoDe(c));
    return { registro: await this.atualizar(c, campos(body), 'editar', usuario.id) };
  }
  async previa(id: string, body: Record<string, unknown>, usuario: UsuarioSessao) {
    const c = await this.lerVersao(id, body, usuario);
    const previa = await this.calcularPrevia(c);
    await this.acesso(usuario, 'campanhas_previa', previa.destinatarios.length, {
      campanhaId: c._id,
    });
    return {
      registro: {
        ...previa,
        destinatarios: previa.destinatarios.map(({ telefoneHash: _hash, ...d }) => d),
      },
    };
  }
  private async calcularPrevia(c: Campanha) {
    const vistos = new Map<string, string>();
    const liberados = new Set(c.repetidosLiberados ?? []);
    const destinatarios: {
      contatoId: string;
      nome: string;
      telefoneMascarado: string;
      elegivel: boolean;
      motivo: string;
      mesmoNumeroDe?: string;
      repetidoLiberado?: boolean;
      telefoneHash?: string;
    }[] = [];
    for (const id of c.contatosIds) {
      const lead = await this.contatos.findOne({ _id: new Types.ObjectId(id) });
      const e = await this.elegibilidade(lead, c.carteiraDe);
      let motivo = e.motivo;
      const primeiro = e.hash ? vistos.get(e.hash) : undefined;
      if (!motivo && primeiro !== undefined && !liberados.has(id)) motivo = 'telefone_duplicado';
      if (!motivo && e.hash && primeiro === undefined)
        vistos.set(e.hash, lead?.nome || 'Contato sem nome');
      destinatarios.push({
        contatoId: id,
        nome: lead?.nome || 'Contato indisponível',
        telefoneMascarado: e.telefone ? mascarar(e.telefone) : '',
        elegivel: !motivo,
        motivo,
        ...(primeiro !== undefined ? { mesmoNumeroDe: primeiro } : {}),
        ...(primeiro !== undefined && !motivo ? { repetidoLiberado: true } : {}),
        ...(!motivo && e.hash ? { telefoneHash: e.hash } : {}),
      });
    }
    return {
      selecionados: c.contatosIds.length,
      elegiveis: destinatarios.filter((d) => d.elegivel).length,
      excluidos: destinatarios.filter((d) => !d.elegivel).length,
      duplicados: destinatarios.filter((d) => d.motivo === 'telefone_duplicado').length,
      destinatarios,
      mensagem: c.mensagem,
      templateCompativel: !!c.template && normalizar(c.template.corpo) === normalizar(c.mensagem),
    };
  }
  async preparar(id: string, body: Record<string, unknown>, usuario: UsuarioSessao) {
    let c = await this.lerVersao(id, body, usuario);
    if (!['rascunho', 'preparando'].includes(c.estado))
      falha('A campanha já foi preparada ou encerrada.', 'CAMPANHA_ESTADO', 409);
    exigirAutoria(c, usuario);
    if (!c.contatosIds.length) falha('Selecione explicitamente os contatos desta campanha.');
    // No modo manual não há template da Meta: o texto vai pelo link do WhatsApp Web.
    if (modoDe(c) === 'api') await this.verificarTemplate(c);
    const previa = await this.calcularPrevia(c);
    if (!previa.elegiveis) falha('Nenhum contato selecionado está elegível. Revise as exclusões.');
    // Estado intermediário recuperável: nunca iniciar uma fila parcialmente materializada.
    if (c.estado === 'rascunho')
      c = await this.atualizar(c, { estado: 'preparando' }, 'preparar_inicio', usuario.id);
    for (const d of previa.destinatarios.filter((d) => d.elegivel)) {
      if (!(await this.campanhas.findOne({ _id: c._id, estado: 'preparando', versao: c.versao })))
        break;
      try {
        await this.fila.updateOne(
          { campanhaId: c._id, contatoId: new Types.ObjectId(d.contatoId) },
          {
            $setOnInsert: {
              _id: new Types.ObjectId(),
              telefoneHash: d.telefoneHash!,
              telefoneMascarado: d.telefoneMascarado,
              estado: 'pendente',
              motivo: '',
              tentativas: 0,
              proximaTentativaEm: this.agora(),
              criadoEm: this.agora(),
              atualizadoEm: this.agora(),
              nivelRecibo: 0,
              eventos: [this.eventoDestinatario('pendente', 0, 'preparado')],
            },
          },
          { upsert: true },
        );
      } catch (erro) {
        if (!erro || typeof erro !== 'object' || !('code' in erro) || erro.code !== 11000)
          throw erro;
      }
    }
    try {
      c = await this.atualizar(
        c,
        { estado: 'preparada', preparadaEm: this.agora() },
        'preparar',
        usuario.id,
      );
    } catch (erro) {
      if ((await this.campanhas.findOne({ _id: c._id }))?.estado === 'cancelada')
        await this.cancelarPendentes(c._id);
      throw erro;
    }
    return { registro: c };
  }
  async transicao(
    id: string,
    acao: 'iniciar' | 'pausar' | 'retomar' | 'cancelar',
    body: Record<string, unknown>,
    usuario: UsuarioSessao,
  ) {
    const c = await this.lerVersao(id, body, usuario);
    exigirAutoria(c, usuario);
    if (usuario.papel === 'vendedor' && acao === 'iniciar')
      falha(
        'O envio automático pela API é iniciado pela gestão. Use o envio manual pelo WhatsApp Web.',
        'PAPEL_INSUFICIENTE',
        403,
      );
    const esperados = {
      iniciar: ['preparada'],
      pausar: ['em_andamento'],
      retomar: ['pausada'],
      cancelar: ['rascunho', 'preparando', 'preparada', 'pausada', 'em_andamento'],
    };
    if (!esperados[acao].includes(c.estado))
      falha(
        'Esta ação não é permitida no estado atual. Atualize a campanha.',
        'CAMPANHA_ESTADO',
        409,
      );
    if (acao === 'iniciar' || acao === 'retomar') {
      if (modoDe(c) === 'manual')
        falha(
          'Campanha manual não tem envio automático. Use "Enviar pelo WhatsApp" em cada contato.',
          'CAMPANHA_MANUAL',
          422,
        );
      if (body.confirmar !== true) falha('Confirme explicitamente o início dos envios.');
      const cfg = configCampanhas();
      if (!cfg.ativo || !cfg.completo)
        falha(
          'Envios desativados ou configuração privada incompleta. O público preparado permanece salvo.',
          'CAMPANHA_DESATIVADA',
          422,
        );
      await this.verificarTemplate(c);
    }
    const estado: EstadoCampanha =
      acao === 'pausar' ? 'pausada' : acao === 'cancelar' ? 'cancelada' : 'em_andamento';
    const registro = await this.atualizar(
      c,
      { estado, ...(!c.iniciadaEm && acao === 'iniciar' ? { iniciadaEm: this.agora() } : {}) },
      acao,
      usuario.id,
    );
    if (acao === 'cancelar') await this.cancelarPendentes(c._id);
    return {
      registro,
      aviso:
        acao === 'pausar' || acao === 'cancelar'
          ? 'Nenhuma nova saída será iniciada. Uma requisição já em andamento pode terminar.'
          : '',
    };
  }
  async resultados(id: string, query: Record<string, unknown>, usuario: UsuarioSessao) {
    const c = await this.ler(id, usuario);
    await this.conciliarRecibos(c._id);
    const pagina = inteiro(query.pagina ?? 1, 1, 10000, 'Página');
    const filtroEstado = texto(query.estado ?? '', 40);
    const FILTROS: Record<string, EstadoDestinatario[]> = {
      falta: ['pendente', 'aberto_manual'],
      nao_aberto: ['pendente'],
      aberto: ['aberto_manual'],
      enviado: ['aceito', 'enviado', 'entregue', 'lido'],
      excluido: ['excluido', 'cancelado', 'falha', 'incerto'],
    };
    if (filtroEstado && !FILTROS[filtroEstado]) falha('Filtro de resultado inválido.');
    const daLista = {
      campanhaId: c._id,
      ...(filtroEstado ? { estado: { $in: FILTROS[filtroEstado] } } : {}),
    };
    const [grupos, linhas, total, respostas] = await Promise.all([
      this.fila
        .aggregate<{ _id: string; quantidade: number }>([
          { $match: { campanhaId: c._id } },
          { $group: { _id: '$estado', quantidade: { $sum: 1 } } },
        ])
        .toArray(),
      this.fila
        .find(daLista)
        .sort({ _id: 1 })
        .skip((pagina - 1) * 30)
        .limit(30)
        .toArray(),
      this.fila.countDocuments(daLista),
      this.fila
        .aggregate<{ total: number }>([
          { $match: { campanhaId: c._id } },
          {
            $lookup: {
              from: 'whatsapp_respostas',
              let: { hash: '$telefoneHash' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ['$telefoneHash', '$$hash'] },
                        { $gte: ['$em', c.iniciadaEm ?? c.criadoEm] },
                      ],
                    },
                  },
                },
                { $limit: 1 },
              ],
              as: 'respostas',
            },
          },
          { $match: { 'respostas.0': { $exists: true } } },
          { $count: 'total' },
        ])
        .toArray(),
    ]);
    const registros = await Promise.all(
      linhas.map(async (linha) => {
        const resposta = await this.conexao
          .db!.collection('whatsapp_respostas')
          .findOne(
            { telefoneHash: linha.telefoneHash, em: { $gte: c.iniciadaEm ?? c.criadoEm } },
            { sort: { em: 1 }, projection: { em: 1 } },
          );
        const contato = await this.contatos.findOne(
          { _id: linha.contatoId },
          { projection: { nome: 1, 'triagem.situacao': 1 } },
        );
        const publico: Partial<Destinatario> = { ...linha };
        delete publico.telefoneHash;
        delete publico.reservaId;
        return {
          ...publico,
          nome: contato?.nome || 'Contato sem nome',
          triagem: contato?.triagem?.situacao ?? '',
          respondeuEm: resposta?.em ?? null,
        };
      }),
    );
    const foraDaCampanha = await this.foraDaCampanha(c);
    const manual = modoDe(c) === 'manual';
    const ultimaManual = manual ? await this.ultimaAberturaManual(c._id) : null;
    const controle = await this.controles.findOne({ _id: 'global' });
    await this.acesso(usuario, 'campanhas_resultados', registros.length, { campanhaId: c._id });
    return {
      registro: {
        resumo: Object.fromEntries(grupos.map((g) => [g._id, g.quantidade])),
        respondidos: respostas[0]?.total ?? 0,
        registros,
        total,
        pagina,
        limite: 30,
        proximaSaidaEm: controle?.proximaSaidaEm ?? null,
        diario: controle?.dia === calendario(this.agora()).dia ? controle.diario : 0,
        modo: modoDe(c),
        foraDaCampanha,
        ultimaAberturaManualEm: ultimaManual,
        aviso: manual
          ? 'Envio manual: o sistema abre a conversa com o texto pronto; quem confirma o envio é você, no WhatsApp. Respostas e pedidos de SAIR chegam no celular e precisam ser registrados no contato.'
          : 'Aceito pela API não significa entregue. Recibos confirmam entrega/leitura. Incertos não são reenviados automaticamente.',
      },
    };
  }
  async auditoria(id: string, usuario: UsuarioSessao) {
    const c = await this.ler(id, usuario);
    return { registro: { eventos: c.auditoria } };
  }

  /**
   * Modo manual: revalida autorização/bloqueio do destinatário, devolve o telefone
   * e o texto para abrir o WhatsApp Web, e registra a abertura. Não envia nada:
   * quem clica enviar é o gestor, no próprio WhatsApp.
   */
  async abrirManual(id: string, destinatarioId: string, usuario: UsuarioSessao) {
    const c = await this.ler(id, usuario);
    exigirAutoria(c, usuario);
    if (modoDe(c) !== 'manual')
      falha('Esta campanha usa a API oficial; o envio é automático.', 'CAMPANHA_NAO_MANUAL', 422);
    if (c.estado !== 'preparada')
      falha(
        'Prepare a campanha antes de abrir as conversas. Campanhas canceladas ou concluídas não abrem conversas.',
        'CAMPANHA_ESTADO',
        409,
      );
    if (!/^[a-f\d]{24}$/i.test(destinatarioId))
      falha('Destinatário não encontrado.', 'DESTINATARIO_AUSENTE', 404);
    const trabalho = await this.fila.findOne({
      _id: new Types.ObjectId(destinatarioId),
      campanhaId: c._id,
    });
    if (!trabalho) falha('Destinatário não encontrado.', 'DESTINATARIO_AUSENTE', 404);
    if (!['pendente', 'aberto_manual'].includes(trabalho.estado))
      falha('Este destinatário não está mais na fila de envio.', 'DESTINATARIO_ESTADO', 409);
    const lead = await this.contatos.findOne({ _id: trabalho.contatoId });
    const e = await this.elegibilidade(lead, c.carteiraDe);
    if (e.motivo || e.hash !== trabalho.telefoneHash) {
      const motivo = e.motivo || 'telefone_alterado';
      await this.finalizar(trabalho, 'excluido', motivo);
      falha(
        'O contato deixou de estar elegível (autorização, bloqueio ou telefone mudou). Nada foi aberto.',
        'DESTINATARIO_INELEGIVEL',
        409,
      );
    }
    // Ritmo: só a primeira abertura de cada contato conta; reabrir não espera.
    if (trabalho.estado === 'pendente') {
      const ultima = await this.ultimaAberturaManual(c._id);
      const liberaEm = ultima ? ultima.getTime() + c.cadencia.intervaloSegundos * 1000 : 0;
      const faltam = Math.ceil((liberaEm - this.agora().getTime()) / 1000);
      if (faltam > 0)
        falha(
          `Aguarde ${faltam}s antes do próximo contato. O intervalo evita que o WhatsApp entenda como envio em massa.`,
          'INTERVALO_MANUAL',
          429,
        );
    }
    const agora = this.agora();
    await this.fila.updateOne(
      { _id: trabalho._id, estado: { $in: ['pendente', 'aberto_manual'] } },
      {
        $set: {
          estado: 'aberto_manual',
          motivo: '',
          atualizadoEm: agora,
          ...(trabalho.estado === 'pendente' ? { abertoEm: agora } : {}),
        },
        $inc: { tentativas: 1 },
        $push: {
          eventos: {
            estado: 'aberto_manual',
            em: agora,
            autor: hmacDocumento(`usuario:${usuario.id}`),
            tentativa: trabalho.tentativas + 1,
            codigo:
              trabalho.estado === 'pendente' ? 'whatsapp_web_aberto' : 'whatsapp_web_reaberto',
          },
        },
      },
    );
    await this.acesso(usuario, 'campanhas_envio_manual', 1, {
      campanhaId: c._id,
      destinatarioId: trabalho._id,
    });
    return {
      registro: {
        telefone: e.telefone!.slice(1),
        texto: c.mensagem,
        primeiraAbertura: trabalho.estado === 'pendente',
      },
    };
  }
  /**
   * Envio manual: o sistema só sabe que a conversa foi aberta. Quem enviou confirma
   * aqui ("Enviei"), ou devolve o contato para a fila ("Não enviei").
   */
  async confirmarManual(
    id: string,
    destinatarioId: string,
    body: Record<string, unknown>,
    usuario: UsuarioSessao,
  ) {
    const c = await this.ler(id, usuario);
    exigirAutoria(c, usuario);
    if (modoDe(c) !== 'manual')
      falha('Só campanhas manuais têm confirmação de envio.', 'CAMPANHA_NAO_MANUAL', 422);
    if (typeof body.enviado !== 'boolean') falha('Informe se a mensagem foi enviada.');
    if (!/^[a-f\d]{24}$/i.test(destinatarioId))
      falha('Destinatário não encontrado.', 'DESTINATARIO_AUSENTE', 404);
    const de: EstadoDestinatario[] = body.enviado
      ? ['aberto_manual', 'pendente']
      : ['aberto_manual', 'enviado'];
    const para: EstadoDestinatario = body.enviado ? 'enviado' : 'pendente';
    const agora = this.agora();
    const r = await this.fila.findOneAndUpdate(
      { _id: new Types.ObjectId(destinatarioId), campanhaId: c._id, estado: { $in: de } },
      {
        $set: {
          estado: para,
          motivo: body.enviado ? 'confirmado_manual' : '',
          atualizadoEm: agora,
          ...(body.enviado ? { enviadoEm: agora } : {}),
        },
        ...(body.enviado ? {} : { $unset: { enviadoEm: '' } }),
        $push: {
          eventos: {
            estado: para,
            em: agora,
            autor: hmacDocumento(`usuario:${usuario.id}`),
            tentativa: 0,
            codigo: body.enviado ? 'envio_confirmado' : 'envio_desfeito',
          },
        },
      },
      { returnDocument: 'after' },
    );
    if (!r)
      falha(
        'Este contato não está aberto no WhatsApp nem confirmado. Atualize a lista.',
        'DESTINATARIO_ESTADO',
        409,
      );
    return { registro: { _id: r._id, estado: r.estado } };
  }

  /**
   * Quem foi selecionado e não está na fila (ou foi excluído dela depois), com o motivo.
   * Antes da preparação a prévia já mostra isso; depois, sem esta lista, eles sumiam da tela.
   */
  private async foraDaCampanha(c: Campanha) {
    if (['rascunho', 'preparando'].includes(c.estado)) return [];
    const fila = await this.fila
      .find(
        { campanhaId: c._id },
        {
          projection: { contatoId: 1, telefoneHash: 1, estado: 1, motivo: 1, telefoneMascarado: 1 },
        },
      )
      .toArray();
    const naFila = new Map(fila.map((f) => [String(f.contatoId), f]));
    const donoDoNumero = new Map<string, string>();
    for (const f of fila)
      if (f.estado !== 'excluido' && !donoDoNumero.has(f.telefoneHash))
        donoDoNumero.set(f.telefoneHash, String(f.contatoId));
    // Fora da fila, ou na fila mas excluído na revalidação (autorização/telefone mudou).
    const ids = c.contatosIds.filter((id) => (naFila.get(id)?.estado ?? 'excluido') === 'excluido');
    const leads = await this.contatos
      .find({
        _id: { $in: [...ids, ...donoDoNumero.values()].map((id) => new Types.ObjectId(id)) },
      })
      .toArray();
    const porId = new Map(leads.map((l) => [l._id.toString(), l]));
    const alteravel = ['preparada', 'pausada'].includes(c.estado);
    const saida: {
      contatoId: string;
      nome: string;
      telefoneMascarado: string;
      motivo: string;
      mesmoNumeroDe: string;
      podeIncluir: boolean;
    }[] = [];
    for (const id of ids) {
      const lead = porId.get(id) ?? null;
      const excluido = naFila.get(id);
      const e = await this.elegibilidade(lead, c.carteiraDe);
      if (excluido) {
        saida.push({
          contatoId: id,
          nome: lead?.nome || 'Contato indisponível',
          telefoneMascarado: excluido.telefoneMascarado,
          motivo: excluido.motivo || 'excluido',
          mesmoNumeroDe: '',
          podeIncluir: alteravel && !e.motivo,
        });
        continue;
      }
      const dono = e.hash ? donoDoNumero.get(e.hash) : undefined;
      const motivo = e.motivo || (dono ? 'telefone_duplicado' : 'apto_apos_preparacao');
      saida.push({
        contatoId: id,
        nome: lead?.nome || 'Contato indisponível',
        telefoneMascarado: e.telefone ? mascarar(e.telefone) : '',
        motivo,
        mesmoNumeroDe: dono ? porId.get(dono)?.nome || 'Contato sem nome' : '',
        podeIncluir: alteravel && !e.motivo,
      });
    }
    return saida;
  }

  /**
   * Quem cuida da campanha decide incluir um contato que ficou de fora por telefone
   * repetido, ou que passou a estar apto depois da preparação. Autorização, bloqueio
   * (SAIR) e carteira continuam sendo conferidos: não há como forçar esses.
   */
  async incluir(id: string, body: Record<string, unknown>, usuario: UsuarioSessao) {
    const c = await this.lerVersao(id, body, usuario);
    exigirAutoria(c, usuario);
    if (!['rascunho', 'preparada', 'pausada'].includes(c.estado))
      falha(
        'Só é possível incluir contatos em rascunho, campanha preparada ou pausada.',
        'CAMPANHA_ESTADO',
        409,
      );
    const contatoId = texto(body.contatoId ?? '', 24);
    if (!/^[a-f\d]{24}$/i.test(contatoId) || !c.contatosIds.includes(contatoId))
      falha('Este contato não faz parte da seleção desta campanha.', 'DESTINATARIO_AUSENTE', 404);
    const oid = new Types.ObjectId(contatoId);
    const e = await this.elegibilidade(await this.contatos.findOne({ _id: oid }), c.carteiraDe);
    if (e.motivo)
      falha(
        'Este contato não pode ser incluído: falta autorização, pediu para sair, está sem telefone válido ou fora da carteira. Ajuste a ficha antes.',
        'DESTINATARIO_INELEGIVEL',
        409,
      );
    const ja =
      c.estado === 'rascunho'
        ? null
        : await this.fila.findOne({ campanhaId: c._id, contatoId: oid });
    if (ja && ja.estado !== 'excluido')
      falha('Este contato já está na fila.', 'DESTINATARIO_ESTADO', 409);
    const registro = await this.atualizar(
      c,
      { repetidosLiberados: [...new Set([...(c.repetidosLiberados ?? []), contatoId])] },
      'incluir_contato',
      usuario.id,
    );
    if (c.estado !== 'rascunho') {
      const agora = this.agora();
      const inicio = {
        estado: 'pendente' as const,
        motivo: '',
        telefoneHash: e.hash!,
        telefoneMascarado: mascarar(e.telefone!),
        proximaTentativaEm: agora,
        atualizadoEm: agora,
      };
      const evento = {
        estado: 'pendente',
        em: agora,
        autor: hmacDocumento(`usuario:${usuario.id}`),
        tentativa: ja?.tentativas ?? 0,
        codigo: 'incluido_pelo_responsavel',
      };
      if (ja)
        await this.fila.updateOne(
          { _id: ja._id, estado: 'excluido' },
          { $set: inicio, $push: { eventos: evento } },
        );
      else
        await this.fila.insertOne({
          _id: new Types.ObjectId(),
          campanhaId: c._id,
          contatoId: oid,
          ...inicio,
          tentativas: 0,
          criadoEm: agora,
          nivelRecibo: 0,
          eventos: [evento],
        });
    }
    return { registro };
  }
  private async ultimaAberturaManual(campanhaId: Types.ObjectId): Promise<Date | null> {
    // abertoEm só é gravado na primeira abertura: reabrir não mexe no ritmo.
    const ultima = await this.fila.findOne(
      { campanhaId, abertoEm: { $exists: true } },
      { sort: { abertoEm: -1 }, projection: { abertoEm: 1 } },
    );
    return ultima?.abertoEm ?? null;
  }
  private async acesso(
    usuario: UsuarioSessao,
    acao: string,
    quantidade: number,
    filtro: Record<string, unknown>,
  ) {
    await this.conexao.db!.collection('acessos_dados').insertOne({
      usuario: new Types.ObjectId(usuario.id),
      acao,
      quantidade,
      ...filtro,
      em: this.agora(),
    });
  }
  private async ler(id: string, usuario?: UsuarioSessao) {
    if (!/^[a-f\d]{24}$/i.test(id)) falha('Campanha não encontrada.', 'CAMPANHA_AUSENTE', 404);
    // Leitura aberta a toda a equipe (ADR-025); quem altera é conferido em exigirAutoria.
    void usuario;
    const c = await this.campanhas.findOne({ _id: new Types.ObjectId(id) });
    if (!c) falha('Campanha não encontrada.', 'CAMPANHA_AUSENTE', 404);
    return c;
  }
  private async lerVersao(id: string, body: Record<string, unknown>, usuario?: UsuarioSessao) {
    const c = await this.ler(id, usuario);
    if (body.versao !== c.versao)
      falha('A campanha foi alterada. Atualize antes de tentar novamente.', 'CAMPANHA_VERSAO', 409);
    return c;
  }
  private evento(acao: string, autor: string, versao: number, campos: string[]) {
    return {
      acao,
      autor: autor === 'worker:campanhas' ? autor : hmacDocumento(`usuario:${autor}`),
      em: this.agora(),
      versao,
      campos,
    };
  }
  private async atualizar(c: Campanha, patch: Partial<Campanha>, acao: string, autor: string) {
    const doc = await this.campanhas.findOneAndUpdate(
      { _id: c._id, versao: c.versao, estado: c.estado },
      {
        $set: { ...patch, alteradoEm: this.agora() },
        $inc: { versao: 1 },
        $push: { auditoria: this.evento(acao, autor, c.versao + 1, Object.keys(patch)) },
      },
      { returnDocument: 'after' },
    );
    if (!doc) falha('Outra ação alterou esta campanha. Atualize a tela.', 'CAMPANHA_VERSAO', 409);
    return doc;
  }
  private async verificarTemplate(c: Campanha) {
    if (!c.template)
      falha(
        'Consulte a Meta e selecione um template de marketing aprovado. Não existe envio de texto livre.',
      );
    const t = (await this.templates()).registros.find(
      (t) =>
        t.id === c.template?.id && t.nome === c.template.nome && t.idioma === c.template.idioma,
    );
    if (
      !t ||
      normalizar(t.corpo) !== normalizar(c.mensagem) ||
      normalizar(t.corpo) !== normalizar(c.template.corpo)
    )
      falha(
        'O template não está aprovado/compatível com a prévia atual. Revise o rascunho e o template na Meta.',
        'TEMPLATE_INCOMPATIVEL',
        422,
      );
    return t;
  }
  private async elegibilidade(lead: LeadCampanha | null, carteiraDe?: string) {
    if (
      !lead ||
      !['rascunho', 'capturado', 'qualificado', 'cliente'].includes(lead.status ?? '') ||
      lead.fundidoEm ||
      lead.lgpd?.eliminadoEm ||
      lead.lgpd?.revogadoEm
    )
      return { motivo: 'contato_indisponivel' };
    if (carteiraDe && String(lead.origem?.vendedorAtribuido ?? '') !== carteiraDe)
      return { motivo: 'fora_da_carteira' };
    if (
      lead.triagem?.situacao === 'desinteressado' &&
      (!lead.triagem.retomarEm || lead.triagem.retomarEm > this.agora())
    )
      return { motivo: 'desinteressado' };
    if (
      lead.lgpd?.contatoComercial !== 'concedido' ||
      !lead.lgpd.consentimentos?.some(
        (c) =>
          c.finalidade === 'contato_comercial' && !c.revogadoEm && c.versaoTermo && c.hashTexto,
      )
    )
      return { motivo: 'sem_autorizacao_documentada' };
    const telefone = [...(lead.telefones ?? [])]
      .sort((a, b) => Number(!!b.principal) - Number(!!a.principal))
      .find((t) => t.whatsapp !== false && /^\+[1-9]\d{7,14}$/.test(t.e164 ?? ''))?.e164;
    if (!telefone) return { motivo: 'sem_telefone_valido' };
    const hash = hmacDocumento(`whatsapp:${telefone.slice(1)}`);
    if (await this.conexao.db!.collection('whatsapp_bloqueios').findOne({ telefoneHash: hash }))
      return { motivo: 'destinatario_solicitou_parada', telefone, hash };
    return { motivo: '', telefone, hash };
  }

  executarCiclo(): Promise<void> {
    if (this.atual) return this.atual;
    if (this.encerrando) return Promise.resolve();
    this.atual = this.ciclo().finally(() => {
      this.atual = undefined;
    });
    return this.atual;
  }
  private async ciclo() {
    await this.conciliarRecibos();
    // Uma reserva abandonada pode ter saído à rede. Nunca retorna a pendente.
    for await (const abandonado of this.fila
      .find({ estado: 'processando', reservaAte: { $lte: this.agora() } })
      .batchSize(100))
      await this.finalizar(abandonado, 'incerto', 'reserva_perdida_verificar_meta');
    const cfg = configCampanhas();
    if (!cfg.ativo || !cfg.completo) return;
    const dono = randomUUID();
    const trava = await this.controles.findOneAndUpdate(
      { _id: 'global', reservaAte: { $lte: this.agora() } },
      { $set: { reservaId: dono, reservaAte: new Date(this.agora().getTime() + LEASE) } },
      { returnDocument: 'after' },
    );
    if (!trava) return;
    // O timeout da requisição é10s; lease120s renovada durante consulta/transporte.
    const renovar = setInterval(() => {
      void this.controles
        .updateOne(
          { _id: 'global', reservaId: dono },
          { $set: { reservaAte: new Date(this.agora().getTime() + LEASE) } },
        )
        .catch(() => undefined);
    }, 5000);
    renovar.unref();
    try {
      const campanhas = await this.campanhas
        // Campanha manual nunca passa pelo transporte automático.
        .find({ estado: 'em_andamento', modo: { $ne: 'manual' } })
        .sort({ iniciadaEm: 1, _id: 1 })
        .toArray();
      for (const c of campanhas) {
        if (
          !(await this.fila.countDocuments({
            campanhaId: c._id,
            estado: { $in: ['pendente', 'processando'] },
          }))
        ) {
          await this.atualizar(c, { estado: 'concluida' }, 'concluir', 'worker:campanhas').catch(
            () => undefined,
          );
          continue;
        }
        const agora = this.agora();
        const controle = await this.controles.findOne({ _id: 'global', reservaId: dono });
        if (!controle || !podeAgendar(agora, c.cadencia, controle)) continue;
        const trabalho = await this.fila.findOne(
          { campanhaId: c._id, estado: 'pendente', proximaTentativaEm: { $lte: agora } },
          { sort: { _id: 1 } },
        );
        if (!trabalho) {
          if (
            !(await this.fila.countDocuments({
              campanhaId: c._id,
              estado: { $in: ['pendente', 'processando'] },
            }))
          ) {
            await this.atualizar(c, { estado: 'concluida' }, 'concluir', 'worker:campanhas').catch(
              () => undefined,
            );
          }
          continue;
        }
        const lead = await this.contatos.findOne({ _id: trabalho.contatoId });
        const e = await this.elegibilidade(lead);
        if (e.motivo || e.hash !== trabalho.telefoneHash) {
          await this.finalizar(trabalho, 'excluido', e.motivo || 'telefone_alterado');
          continue;
        }
        const respondeu = await this.conexao.db!.collection('whatsapp_respostas').findOne({
          telefoneHash: trabalho.telefoneHash,
          em: { $gte: c.iniciadaEm ?? c.criadoEm },
        });
        if (respondeu) {
          await this.finalizar(trabalho, 'excluido', 'destinatario_respondeu');
          continue;
        }
        try {
          await this.verificarTemplate(c);
        } catch {
          await this.atualizar(
            c,
            { estado: 'pausada' },
            'pausar_template_indisponivel',
            'worker:campanhas',
          ).catch(() => undefined);
          continue;
        }
        // Releitura imediatamente antes de reservar saída: pause/consentimento/flag.
        const atual = await this.campanhas.findOne({
          _id: c._id,
          estado: 'em_andamento',
          versao: c.versao,
        });
        const recente = await this.elegibilidade(
          await this.contatos.findOne({ _id: trabalho.contatoId }),
        );
        if (!atual || !configCampanhas().ativo || this.encerrando) continue;
        if (recente.motivo || recente.hash !== trabalho.telefoneHash) {
          await this.finalizar(trabalho, 'excluido', recente.motivo || 'telefone_alterado');
          continue;
        }
        const saidaEm = this.agora();
        const controleSaida = await this.controles.findOne({
          _id: 'global',
          reservaId: dono,
          reservaAte: { $gt: saidaEm },
        });
        if (!controleSaida || !podeAgendar(saidaEm, c.cadencia, controleSaida)) continue;
        const reservado = await this.fila.findOneAndUpdate(
          { _id: trabalho._id, estado: 'pendente' },
          {
            $set: {
              estado: 'processando',
              reservaId: dono,
              reservaAte: new Date(saidaEm.getTime() + LEASE),
              atualizadoEm: saidaEm,
            },
            $inc: { tentativas: 1 },
            $push: {
              eventos: this.eventoDestinatario('processando', trabalho.tentativas + 1, 'reserva'),
            },
          },
          { returnDocument: 'after' },
        );
        if (!reservado) continue;
        const cal = calendario(saidaEm);
        const mesmoDia = controleSaida.dia === cal.dia;
        const lote = mesmoDia ? controleSaida.lote + 1 : 1;
        const pausa = lote >= c.cadencia.loteTamanho;
        const slot = await this.controles.updateOne(
          { _id: 'global', reservaId: dono, reservaAte: { $gt: this.agora() } },
          {
            $set: {
              dia: cal.dia,
              diario: (mesmoDia ? controleSaida.diario : 0) + 1,
              lote: pausa ? 0 : lote,
              pausaAte: pausa
                ? new Date(saidaEm.getTime() + c.cadencia.pausaLoteSegundos * 1000)
                : mesmoDia
                  ? (controleSaida.pausaAte ?? new Date(0))
                  : new Date(0),
              ultimaSaidaEm: saidaEm,
              proximaSaidaEm: new Date(saidaEm.getTime() + c.cadencia.intervaloSegundos * 1000),
            },
          },
        );
        if (slot.matchedCount !== 1) {
          await this.finalizar(reservado, 'incerto', 'reserva_global_perdida');
          return;
        }
        await this.enviar(c, reservado, recente.telefone!);
        return; // No máximo um POST por ciclo, mesmo entre campanhas diferentes.
      }
    } finally {
      clearInterval(renovar);
      await this.controles.updateOne(
        { _id: 'global', reservaId: dono },
        { $set: { reservaAte: this.agora() }, $unset: { reservaId: '' } },
      );
    }
  }
  private async enviar(c: Campanha, trabalho: Destinatario, telefone: string) {
    const cfg = configCampanhas();
    if (!cfg.ativo || !cfg.completo || this.encerrando) {
      await this.fila.updateOne(
        { _id: trabalho._id, reservaId: trabalho.reservaId },
        {
          $set: { estado: 'pendente', motivo: 'aguardando_ativacao' },
          $unset: { reservaId: '', reservaAte: '' },
          $push: {
            eventos: this.eventoDestinatario(
              'pendente',
              trabalho.tentativas,
              'aguardando_ativacao',
            ),
          },
        },
      );
      return;
    }
    try {
      const lock = await this.controles.findOne({
        _id: 'global',
        reservaId: trabalho.reservaId,
        reservaAte: { $gt: this.agora() },
      });
      const campanhaAtual = await this.campanhas.findOne({
        _id: c._id,
        estado: 'em_andamento',
        versao: c.versao,
      });
      if (!lock || !campanhaAtual) {
        await this.finalizar(trabalho, 'incerto', 'reserva_ou_campanha_alterada');
        return;
      }
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
            template: { name: c.template!.nome, language: { code: c.template!.idioma } },
          }),
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (resposta.status === 429) {
        if (trabalho.tentativas >= 5) {
          await this.finalizar(trabalho, 'falha', 'limite_tentativas_429');
          return;
        }
        const raw = resposta.headers.get('retry-after')?.trim() ?? '';
        const servidor = /^\d+$/.test(raw)
          ? this.agora().getTime() + Number(raw) * 1000
          : Date.parse(raw);
        const prazo = new Date(
          Math.max(
            this.agora().getTime() + Math.min(3_600_000, 60_000 * 2 ** (trabalho.tentativas - 1)),
            Number.isFinite(servidor) ? servidor : 0,
          ),
        );
        await this.fila.updateOne(
          { _id: trabalho._id, estado: 'processando', reservaId: trabalho.reservaId },
          {
            $set: {
              estado: 'pendente',
              motivo: 'http_429',
              proximaTentativaEm: prazo,
              atualizadoEm: this.agora(),
            },
            $unset: { reservaId: '', reservaAte: '' },
            $push: {
              eventos: this.eventoDestinatario('pendente', trabalho.tentativas, 'http_429'),
            },
          },
        );
        await this.controles.updateOne(
          { _id: 'global', reservaId: trabalho.reservaId },
          { $max: { proximaSaidaEm: prazo } },
        );
        return;
      }
      if (resposta.status >= 500 || resposta.status === 408) {
        await this.finalizar(trabalho, 'incerto', `http_${resposta.status}_verificar_meta`);
        return;
      }
      if (!resposta.ok) {
        await this.finalizar(trabalho, 'falha', `http_${resposta.status}`);
        if (resposta.status === 401 || resposta.status === 403)
          await this.atualizar(
            c,
            { estado: 'pausada' },
            'pausar_autorizacao_meta',
            'worker:campanhas',
          ).catch(() => undefined);
        return;
      }
      const payload = objeto(await resposta.json());
      const id = objeto(Array.isArray(payload.messages) ? payload.messages[0] : null).id;
      if (typeof id !== 'string' || !id.startsWith('wamid.') || id.length > 500) {
        await this.finalizar(trabalho, 'incerto', 'resposta_sem_id_verificar_meta');
        return;
      }
      await this.fila.updateOne(
        { _id: trabalho._id, estado: 'processando', reservaId: trabalho.reservaId },
        {
          $set: { estado: 'aceito', mensagemId: id, motivo: '', atualizadoEm: this.agora() },
          $unset: { reservaId: '', reservaAte: '' },
          $push: { eventos: this.eventoDestinatario('aceito', trabalho.tentativas, 'api_aceitou') },
        },
      );
      await this.conciliarRecibos(c._id);
    } catch {
      await this.finalizar(trabalho, 'incerto', 'resultado_ambiguo_verificar_meta');
    }
  }
  private async finalizar(t: Destinatario, estado: EstadoDestinatario, motivo: string) {
    await this.fila.updateOne(
      {
        _id: t._id,
        estado: { $in: ['pendente', 'processando'] },
        ...(t.reservaId ? { reservaId: t.reservaId } : {}),
      },
      {
        $set: { estado, motivo, atualizadoEm: this.agora() },
        $unset: { reservaId: '', reservaAte: '' },
        $push: { eventos: this.eventoDestinatario(estado, t.tentativas, motivo) },
      },
    );
  }
  private eventoDestinatario(estado: string, tentativa: number, codigo: string) {
    return { estado, em: this.agora(), autor: 'worker:campanhas', tentativa, codigo };
  }
  private async cancelarPendentes(campanhaId: Types.ObjectId) {
    for await (const t of this.fila.find({ campanhaId, estado: 'pendente' }).batchSize(100))
      await this.finalizar(t, 'cancelado', 'campanha_cancelada');
  }
  private async conciliarRecibos(campanhaId?: Types.ObjectId) {
    const trabalhos = this.fila
      .find({
        ...(campanhaId ? { campanhaId } : {}),
        mensagemId: { $exists: true },
        estado: { $in: ['aceito', 'enviado', 'entregue', 'falha'] },
      })
      .batchSize(100);
    for await (const t of trabalhos) {
      const recibo = await this.conexao
        .db!.collection('whatsapp_recibos')
        .findOne({ mensagemId: t.mensagemId });
      if (!recibo) continue;
      const [estado, nivel]: [EstadoDestinatario, number] = recibo.lido
        ? ['lido', 4]
        : recibo.entregue
          ? ['entregue', 3]
          : recibo.falhou
            ? ['falha', 2]
            : ['enviado', 1];
      await this.fila.updateOne(
        { _id: t._id, nivelRecibo: { $lt: nivel } },
        {
          $set: {
            estado,
            nivelRecibo: nivel,
            motivo:
              estado === 'falha' ? `meta_${String(recibo.codigo ?? 'falha').slice(0, 30)}` : '',
            atualizadoEm: this.agora(),
          },
          $push: { eventos: this.eventoDestinatario(estado, t.tentativas, 'recibo') },
        },
      );
    }
  }
}

export function calendario(agora: Date) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(agora);
  const ler = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '';
  return {
    dia: `${ler('year')}-${ler('month')}-${ler('day')}`,
    hora: `${ler('hour')}:${ler('minute')}`,
    util: !['Sat', 'Sun'].includes(ler('weekday')),
  };
}
export function podeAgendar(agora: Date, c: Cadencia, controle: ControleCampanha) {
  const cal = calendario(agora);
  if (
    !cal.util ||
    !(
      (cal.hora >= c.inicioManha && cal.hora < c.fimManha) ||
      (cal.hora >= c.inicioTarde && cal.hora < c.fimTarde)
    )
  )
    return false;
  if (
    controle.proximaSaidaEm > agora ||
    (controle.ultimaSaidaEm &&
      controle.ultimaSaidaEm.getTime() + c.intervaloSegundos * 1000 > agora.getTime())
  )
    return false;
  if (
    controle.dia === cal.dia &&
    (controle.diario >= c.tetoDiario || (controle.pausaAte && controle.pausaAte > agora))
  )
    return false;
  return true;
}
function campos(body: Record<string, unknown>): Partial<Campanha> {
  const patch: Partial<Campanha> = {};
  if ('titulo' in body) patch.titulo = texto(body.titulo, 160);
  if ('mensagem' in body) patch.mensagem = texto(body.mensagem, 4000);
  if ('contatosIds' in body) {
    if (
      !Array.isArray(body.contatosIds) ||
      body.contatosIds.length > MAX_PUBLICO ||
      !body.contatosIds.every((id) => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id))
    )
      falha('Selecione até 2.000 IDs válidos de contatos.');
    patch.contatosIds = [...new Set(body.contatosIds as string[])];
  }
  if ('modo' in body) {
    if (!MODOS_ENVIO.includes(body.modo as ModoEnvio))
      falha('Modo de envio inválido. Use "api" ou "manual".');
    patch.modo = body.modo as ModoEnvio;
  }
  if ('template' in body) {
    if (body.template === null) patch.template = null;
    else {
      const t = objeto(body.template);
      patch.template = {
        id: texto(t.id, 100),
        nome: texto(t.nome, 512),
        idioma: texto(t.idioma, 20),
        corpo: texto(t.corpo, 4000),
        status: 'NAO_VERIFICADO',
        categoria: 'MARKETING',
      };
    }
  }
  if ('cadencia' in body) {
    const x = objeto(body.cadencia);
    const c = { ...CADENCIA_PADRAO };
    c.intervaloSegundos = inteiro(
      x.intervaloSegundos ?? c.intervaloSegundos,
      60,
      86400,
      'Intervalo',
    );
    c.loteTamanho = inteiro(x.loteTamanho ?? c.loteTamanho, 1, 100, 'Lote');
    c.pausaLoteSegundos = inteiro(x.pausaLoteSegundos ?? c.pausaLoteSegundos, 60, 86400, 'Pausa');
    c.tetoDiario = inteiro(x.tetoDiario ?? c.tetoDiario, 1, 2000, 'Teto diário');
    for (const k of ['inicioManha', 'fimManha', 'inicioTarde', 'fimTarde'] as const) {
      if (k in x) c[k] = texto(x[k], 5);
      if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(c[k])) falha('Horário inválido. Use HH:MM.');
    }
    if (!(c.inicioManha < c.fimManha && c.fimManha <= c.inicioTarde && c.inicioTarde < c.fimTarde))
      falha('Os horários precisam formar duas janelas ordenadas, sem sobreposição.');
    patch.cadencia = c;
  }
  return patch;
}
function inteiro(x: unknown, min: number, max: number, nome: string) {
  const n = typeof x === 'string' && /^\d+$/.test(x) ? Number(x) : x;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < min || n > max)
    falha(`${nome}: informe um inteiro entre ${min} e ${max}.`);
  return n;
}
function texto(x: unknown, max: number) {
  if (typeof x !== 'string' || x.length > max)
    falha(`Texto inválido ou maior que ${max} caracteres.`);
  return x.trim();
}
function objeto(x: unknown): Record<string, unknown> {
  return x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : {};
}
function normalizar(x: string) {
  return x.replace(/\r\n/g, '\n').trim();
}
/** Todos veem; alterar, preparar e enviar é de quem criou a campanha ou da gestão. */
function exigirAutoria(c: Campanha, usuario: UsuarioSessao) {
  if (usuario.papel === 'vendedor' && c.criadoPor !== usuario.id)
    falha(
      'Você pode acompanhar esta campanha, mas só quem a criou ou a gestão pode alterá-la ou enviar por ela.',
      'CAMPANHA_DE_OUTRA_PESSOA',
      403,
    );
}
function carteiraDoPapel(usuario: UsuarioSessao): Record<string, unknown> {
  return usuario.papel === 'vendedor'
    ? { 'origem.vendedorAtribuido': new Types.ObjectId(usuario.id) }
    : {};
}
function exigirModoDoPapel(usuario: UsuarioSessao, patch: Partial<Campanha>, atual: ModoEnvio) {
  if (usuario.papel === 'vendedor' && (patch.modo ?? atual) !== 'manual')
    falha(
      'Representantes usam o envio manual pelo WhatsApp Web. A API oficial fica com a gestão.',
      'PAPEL_INSUFICIENTE',
      403,
    );
}
function pistaTelefone(telefones: LeadCampanha['telefones']): string {
  const t = telefones?.find((x) => x.principal) ?? telefones?.[0];
  const digitos = String(t?.e164 || t?.bruto || '').replace(/\D/g, '');
  if (!digitos) return 'Nenhum telefone registrado';
  const fim = digitos.slice(-4);
  const whatsapp = t?.whatsapp === false ? '; marcado como sem WhatsApp' : '';
  return `${digitos.length} dígitos, final ${fim}${whatsapp}`;
}
function mascarar(x: string) {
  return `+${x.slice(1, 3)} ••••• ${x.slice(-4)}`;
}
function dataCivil(x: unknown) {
  if (
    typeof x !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(x) ||
    !Number.isFinite(Date.parse(x)) ||
    new Date(`${x}T00:00:00Z`).toISOString().slice(0, 10) !== x
  )
    falha('Data inválida. Use AAAA-MM-DD.');
  return new Date(`${x}T00:00:00-03:00`);
}
export function modeloAprovado(item: unknown): ModeloCampanha | null {
  const t = objeto(item);
  if (t.status !== 'APPROVED' || t.category !== 'MARKETING' || !Array.isArray(t.components))
    return null;
  // Somente BODY simples. Headers, botões e variáveis requerem suporte próprio.
  if (t.components.length !== 1) return null;
  const corpo = objeto(t.components[0]);
  if (
    corpo.type !== 'BODY' ||
    typeof corpo.text !== 'string' ||
    !corpo.text.trim() ||
    corpo.text.length > 4000 ||
    /\{\{|\}\}/.test(corpo.text)
  )
    return null;
  if (
    typeof t.id !== 'string' ||
    !/^\d{1,100}$/.test(t.id) ||
    typeof t.name !== 'string' ||
    !/^[a-z][a-z0-9_]{0,511}$/.test(t.name) ||
    typeof t.language !== 'string' ||
    !/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(t.language)
  )
    return null;
  return {
    id: t.id,
    nome: t.name,
    idioma: t.language,
    corpo: corpo.text.trim(),
    status: 'APPROVED',
    categoria: 'MARKETING',
  };
}
/** Campanhas criadas antes do modo manual não têm o campo: são da API oficial. */
export function modoDe(c: Pick<Campanha, 'modo'>): ModoEnvio {
  return c.modo === 'manual' ? 'manual' : 'api';
}
