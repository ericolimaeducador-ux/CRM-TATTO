import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types, type HydratedDocument } from 'mongoose';
import { randomBytes } from 'node:crypto';
import { hmacDocumento } from '../seguranca/cifra';
import type { UsuarioSessao } from '../contatos/sessao.middleware';
import { aoAlterarContato } from '../contatos/contato-alterado';
import { paraCsv, paraXlsx } from '../exportacao/tabela';
import { falha, PADROES, sanitizar, tipoValido, totalizar } from './comercial.campos';
import {
  DocumentoComercial,
  ETAPAS,
  type EventoComercial,
  type TipoComercial,
} from './comercial.schema';

type Doc = DocumentoComercial & { _id: Types.ObjectId };
const GESTAO = ['admin', 'gestor'];
const FILTROS_AUDITAVEIS = [
  'contaId',
  'etapa',
  'status',
  'treinamentoId',
  'produtoId',
  'arquivados',
  'pagina',
  'limite',
];
@Injectable()
export class ComercialService implements OnModuleInit, OnModuleDestroy {
  private readonly limiteInscricao = new Map<string, { inicio: number; quantidade: number }>();
  private desligarSincronizacao?: () => void;
  constructor(
    @InjectModel('Comercial') private readonly registros: Model<DocumentoComercial>,
    @InjectConnection() private readonly conexao: Connection,
  ) {}
  onModuleInit() {
    this.desligarSincronizacao = aoAlterarContato((e) =>
      this.sincronizarContaDoContato(e.contatoId, e.autorId),
    );
  }
  onModuleDestroy() {
    this.desligarSincronizacao?.();
  }

  /**
   * Contatos é o cadastro único (ADR-028). A conta da carteira é criada quando o contato
   * é qualificado e espelha nome, WhatsApp, e-mail, cidade, UF, tipo e responsável.
   * Campos só comerciais (classificação, especialidade, próxima ação) continuam na conta.
   * Contato descartado, fundido ou eliminado arquiva a conta, sem apagar histórico.
   */
  async sincronizarContaDoContato(contatoId: string, autorId: string): Promise<void> {
    if (!/^[a-f\d]{24}$/i.test(contatoId)) return;
    const contato = await this.conexao.collection('contatos').findOne(
      { _id: new Types.ObjectId(contatoId) },
      {
        projection: {
          nome: 1,
          status: 1,
          tipoPessoa: 1,
          emails: 1,
          telefones: 1,
          enderecos: 1,
          origem: 1,
          fundidoEm: 1,
          'lgpd.eliminadoEm': 1,
        },
      },
    );
    const autor = { id: autorId, papel: 'admin', nome: 'sincronizacao' } as UsuarioSessao;
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      const conta = await this.registros
        .findOne({ tipo: 'contas', 'campos.contatoOrigemId': contatoId })
        .lean<Doc | null>();
      const agora = new Date();
      const ativo =
        contato &&
        !contato.fundidoEm &&
        !contato.lgpd?.eliminadoEm &&
        ['qualificado', 'cliente'].includes(String(contato.status));
      if (!ativo) {
        if (!conta || conta.arquivado) return;
        const r = await this.registros.updateOne(
          { _id: conta._id, versao: conta.versao },
          {
            $set: { arquivado: true, alteradoEm: agora, alteradoPor: autorId },
            $inc: { versao: 1 },
            $push: {
              auditoria: evento(
                'arquivar_do_contato',
                autor,
                conta.versao + 1,
                { arquivado: true },
                agora,
              ),
            },
          },
        );
        if (r.matchedCount) return;
        continue;
      }
      const espelho = camposDoContato(contatoId, contato as Record<string, unknown>);
      const vendedor = (contato.origem as { vendedorAtribuido?: unknown } | undefined)
        ?.vendedorAtribuido;
      const donoId = vendedor ? String(vendedor) : (conta?.donoId ?? autorId);
      const situacao = contato.status === 'cliente' ? { status: 'ativo' } : {};
      if (!conta) {
        const campos = { ...PADROES.contas, ...espelho, status: 'prospect', ...situacao };
        try {
          await this.registros.create({
            tipo: 'contas',
            campos,
            donoId,
            versao: 1,
            arquivado: false,
            criadoEm: agora,
            alteradoEm: agora,
            criadoPor: autorId,
            alteradoPor: autorId,
            auditoria: [evento('criar_do_contato', autor, 1, campos, agora)],
          });
          return;
        } catch (erro) {
          if (!isDuplicateKey(erro)) throw erro;
          continue;
        }
      }
      const novos: Record<string, unknown> = { ...espelho, ...situacao };
      const mudou = Object.keys(novos).filter(
        (k) => JSON.stringify(conta.campos[k]) !== JSON.stringify(novos[k]),
      );
      if (!mudou.length && conta.donoId === donoId && !conta.arquivado) return;
      const alterados = Object.fromEntries(mudou.map((k) => [k, novos[k]]));
      const r = await this.registros.updateOne(
        { _id: conta._id, versao: conta.versao },
        {
          $set: {
            campos: { ...conta.campos, ...novos },
            donoId,
            arquivado: false,
            alteradoEm: agora,
            alteradoPor: autorId,
          },
          $inc: { versao: 1 },
          $push: {
            auditoria: evento(
              'sincronizar_contato',
              autor,
              conta.versao + 1,
              { ...alterados, ...(conta.donoId !== donoId ? { donoId } : {}) },
              agora,
            ),
          },
        },
      );
      if (r.matchedCount) return;
    }
  }

  private escopo(tipo: TipoComercial, usuario: UsuarioSessao): Record<string, unknown> {
    return {
      tipo,
      ...(tipo !== 'produtos' && usuario.papel === 'vendedor' ? { donoId: usuario.id } : {}),
    };
  }
  private escrita(tipo: TipoComercial, usuario: UsuarioSessao): void {
    if (
      !['admin', 'gestor', 'vendedor'].includes(usuario.papel) ||
      (tipo === 'produtos' && !GESTAO.includes(usuario.papel))
    )
      falha('Seu perfil não pode alterar esta seção.', 'PAPEL_INSUFICIENTE', 403);
  }
  async listar(tipoBruto: string, query: Record<string, string>, usuario: UsuarioSessao) {
    const tipo = tipoValido(tipoBruto);
    this.exigirAcessoSecao(tipo, usuario);
    const filtro = this.escopo(tipo, usuario);
    filtro.arquivado = query.arquivados === 'true';
    const pagina = inteiroQuery(query.pagina, 1, 1, 100_000);
    const limite = inteiroQuery(query.limite, 30, 1, 100);
    if (query.q) {
      if (typeof query.q !== 'string' || query.q.length > 100)
        falha('Use uma busca de até 100 caracteres.');
      const busca = new RegExp(query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filtro.$or = [
        'nome',
        'titulo',
        'cidade',
        'fabricante',
        'territorio',
        'contatoNome',
        'pessoas.nome',
        'pessoas.email',
      ].map((campo) => ({ [`campos.${campo}`]: busca }));
    }
    for (const campo of ['contaId', 'etapa', 'status', 'treinamentoId', 'produtoId']) {
      if (!query[campo]) continue;
      if (typeof query[campo] !== 'string' || query[campo].length > 100) falha('Filtro inválido.');
      filtro[`campos.${campo}`] = query[campo];
    }
    const [registros, total] = await Promise.all([
      this.registros
        .find(filtro)
        .select('-auditoria')
        .sort({ alteradoEm: -1, _id: -1 })
        .skip((pagina - 1) * limite)
        .limit(limite)
        .lean<Doc[]>(),
      this.registros.countDocuments(filtro),
    ]);
    await this.conexao.collection('acessos_dados').insertOne({
      usuario: new Types.ObjectId(usuario.id),
      acao: 'listagem_comercial',
      secao: tipo,
      filtro: filtrosDeAuditoria(query),
      quantidadeRetornada: registros.length,
      em: new Date(),
    });
    return { registros: registros.map(vista), total, pagina, limite };
  }
  async obter(tipoBruto: string, id: string, usuario: UsuarioSessao) {
    const doc = await this.exigir(tipoValido(tipoBruto), id, usuario);
    return { registro: vista(doc) };
  }
  async auditoria(tipoBruto: string, id: string, usuario: UsuarioSessao) {
    const doc = await this.exigir(tipoValido(tipoBruto), id, usuario);
    return { eventos: doc.auditoria };
  }
  async criar(tipoBruto: string, corpo: Record<string, unknown>, usuario: UsuarioSessao) {
    const tipo = tipoValido(tipoBruto);
    this.escrita(tipo, usuario);
    const campos = { ...PADROES[tipo], ...sanitizar(tipo, corpo) };
    if (tipo === 'atividades') await this.validarEquipeAtiva(campos);
    if (tipo === 'treinamentos') validarJanelaTreinamento(campos);
    const donoId = await this.donoDoRegistro(tipo, campos, usuario);
    if (tipo === 'precosCliente') {
      campos.status = 'solicitado';
      campos.solicitadoPor = usuario.id;
    }
    if (
      tipo === 'participantes' &&
      !GESTAO.includes(usuario.papel) &&
      (campos.status !== 'inscrito' || campos.presente === true || campos.confirmado === true)
    )
      falha(
        'Representantes podem registrar inscrições; confirmação e presença ficam com a gestão.',
        'PAPEL_INSUFICIENTE',
        403,
      );
    if (tipo === 'participantes') {
      const treinamento = await this.exigir(
        'treinamentos',
        String(campos.treinamentoId ?? ''),
        usuario,
      );
      if (treinamento.donoId !== donoId)
        falha('O participante precisa pertencer à carteira do treinamento.');
      const emailHash = hashEmailParticipante(campos.email);
      if (emailHash) {
        campos.emailHash = emailHash;
        const existente = await this.registros
          .findOne({
            tipo: 'participantes',
            donoId,
            'campos.treinamentoId': String(campos.treinamentoId),
            'campos.emailHash': emailHash,
          })
          .lean<Doc | null>();
        if (existente) return { registro: vista(existente) };
      }
    }
    await this.checarReferencias(tipo, campos, usuario, donoId);
    if (tipo === 'propostas') totalizar(campos);
    const agora = new Date();
    let doc: HydratedDocument<DocumentoComercial>;
    try {
      doc = await this.registros.create({
        tipo,
        campos,
        donoId,
        versao: 1,
        arquivado: false,
        criadoEm: agora,
        alteradoEm: agora,
        criadoPor: usuario.id,
        alteradoPor: usuario.id,
        auditoria: [evento('criar', usuario, 1, campos, agora)],
      });
    } catch (erro) {
      if (
        tipo === 'participantes' &&
        isDuplicateKey(erro) &&
        typeof campos.emailHash === 'string'
      ) {
        const existente = await this.registros
          .findOne({
            tipo: 'participantes',
            donoId,
            'campos.treinamentoId': String(campos.treinamentoId),
            'campos.emailHash': campos.emailHash,
          })
          .lean<Doc | null>();
        if (existente) return { registro: vista(existente) };
      }
      throw erro;
    }
    return { registro: vista(doc.toObject() as Doc) };
  }
  async atualizar(
    tipoBruto: string,
    id: string,
    corpo: Record<string, unknown>,
    usuario: UsuarioSessao,
  ) {
    const tipo = tipoValido(tipoBruto);
    this.escrita(tipo, usuario);
    const antes = await this.exigir(tipo, id, usuario);
    if (tipo === 'precosCliente' && 'status' in corpo)
      falha('A situação do preço só muda pelas ações de aprovação e encerramento.');
    if (
      tipo === 'precosCliente' &&
      ['aprovado', 'reprovado', 'ganho', 'perdido'].includes(String(antes.campos.status))
    )
      falha('Um preço decidido ou encerrado não pode ser editado; crie uma nova solicitação.');
    if (
      tipo === 'participantes' &&
      !GESTAO.includes(usuario.papel) &&
      ('confirmado' in corpo || 'presente' in corpo || 'status' in corpo)
    )
      falha(
        'Somente a gestão pode confirmar presença ou alterar o estado do participante.',
        'PAPEL_INSUFICIENTE',
        403,
      );
    if (!Number.isSafeInteger(corpo.versao) || corpo.versao !== antes.versao)
      falha(
        'Este registro mudou. Atualize a tela antes de salvar novamente.',
        'CONFLITO_VERSAO',
        409,
      );
    if (antes.auditoria.length >= 5000)
      falha(
        'Este registro atingiu o limite de alterações. Consulte o administrador.',
        'LIMITE_AUDITORIA',
        409,
      );
    if ('arquivado' in corpo && typeof corpo.arquivado !== 'boolean')
      falha('O arquivamento precisa ser verdadeiro ou falso.');
    const alteracoes = sanitizar(tipo, corpo);
    const campos = { ...antes.campos, ...alteracoes };
    if (
      tipo === 'atividades' &&
      ('responsavelId' in alteracoes || 'colaboradoresIds' in alteracoes)
    )
      await this.validarEquipeAtiva(campos);
    if (tipo === 'treinamentos') validarJanelaTreinamento(campos);
    if (
      tipo === 'atividades' &&
      antes.campos.status === 'planejada' &&
      campos.status === 'concluida'
    ) {
      campos.realizadoEm = new Date().toISOString();
      campos.realizadoPor = usuario.id;
    }
    const arquivado = typeof corpo.arquivado === 'boolean' ? corpo.arquivado : antes.arquivado;
    if (tipo === 'precosCliente' && 'status' in alteracoes)
      falha('A situação do preço é controlada por ação própria.');
    await this.checarReferencias(tipo, campos, usuario, antes.donoId);
    if (tipo === 'propostas') totalizar(campos);
    const agora = new Date();
    const doc = await this.registros
      .findOneAndUpdate(
        { ...this.escopo(tipo, usuario), _id: id, versao: antes.versao },
        {
          $set: { campos, arquivado, alteradoEm: agora, alteradoPor: usuario.id },
          $inc: { versao: 1 },
          $push: {
            auditoria: evento(
              arquivado !== antes.arquivado ? (arquivado ? 'arquivar' : 'restaurar') : 'editar',
              usuario,
              antes.versao + 1,
              { ...alteracoes, ...(arquivado !== antes.arquivado ? { arquivado } : {}) },
              agora,
            ),
          },
        },
        { new: true },
      )
      .lean<Doc | null>();
    if (!doc)
      falha('Outra alteração foi gravada primeiro. Atualize a tela.', 'CONFLITO_VERSAO', 409);
    return { registro: vista(doc as Doc) };
  }
  async decidirPreco(
    id: string,
    decisao: 'aprovar' | 'reprovar',
    corpo: Record<string, unknown>,
    usuario: UsuarioSessao,
  ) {
    if (!GESTAO.includes(usuario.papel))
      falha('Somente gestor ou admin pode decidir preço especial.', 'PAPEL_INSUFICIENTE', 403);
    const antes = await this.exigir('precosCliente', id, usuario);
    if (corpo.versao !== antes.versao)
      falha('Este preço mudou. Atualize antes de decidir.', 'CONFLITO_VERSAO', 409);
    if (!['solicitado', 'aguardando_aprovacao'].includes(String(antes.campos.status)))
      falha('Este pedido de preço já recebeu uma decisão.', 'TRANSICAO_INVALIDA', 409);
    const motivo = typeof corpo.motivo === 'string' ? corpo.motivo.trim() : '';
    if (decisao === 'reprovar' && (!motivo || motivo.length > 1000))
      falha('Informe o motivo da reprovação.');
    if (motivo.length > 1000) falha('O motivo deve ter até 1.000 caracteres.');
    return this.gravarAcao('precosCliente', id, usuario, antes, decisao, {
      status: decisao === 'aprovar' ? 'aprovado' : 'reprovado',
      motivoDecisao: motivo,
      decisaoEm: new Date().toISOString(),
      decisaoPor: usuario.id,
    });
  }
  async encerrarPreco(id: string, corpo: Record<string, unknown>, usuario: UsuarioSessao) {
    const antes = await this.exigir('precosCliente', id, usuario);
    if (corpo.versao !== antes.versao)
      falha('Este preço mudou. Atualize antes de encerrar.', 'CONFLITO_VERSAO', 409);
    if (antes.campos.status !== 'aprovado')
      falha('Somente um preço aprovado pode ser encerrado.', 'TRANSICAO_INVALIDA', 409);
    const resultado = corpo.resultado;
    if (resultado !== 'ganho' && resultado !== 'perdido') falha('Escolha ganho ou perdido.');
    const motivo = typeof corpo.motivo === 'string' ? corpo.motivo.trim() : '';
    if (resultado === 'perdido' && !motivo) falha('Informe o motivo da perda.');
    if (motivo.length > 1000) falha('O motivo deve ter até 1.000 caracteres.');
    return this.gravarAcao('precosCliente', id, usuario, antes, `encerrar_${resultado}`, {
      status: resultado,
      motivoFechamento: motivo,
      encerradoEm: new Date().toISOString(),
      encerradoPor: usuario.id,
    });
  }
  async solicitarRascunhoEmailProposta(
    id: string,
    corpo: Record<string, unknown>,
    usuario: UsuarioSessao,
  ) {
    const antes = await this.exigir('propostas', id, usuario);
    if (antes.arquivado) falha('Restaure a proposta antes de preparar o e-mail.');
    if (!Number.isSafeInteger(corpo.versao) || corpo.versao !== antes.versao)
      falha('A proposta mudou. Atualize antes de preparar o e-mail.', 'CONFLITO_VERSAO', 409);
    if (typeof antes.campos.contaId !== 'string' || !antes.campos.contaId)
      falha('Vincule a proposta a uma conta antes de preparar o e-mail.');
    if (typeof antes.campos.contatoId !== 'string' || !antes.campos.contatoId)
      falha('Escolha um contato da conta antes de preparar o e-mail.');
    const conta = await this.exigir('contas', antes.campos.contaId, usuario);
    if (conta.arquivado) falha('A conta da proposta está arquivada. Restaure antes de continuar.');
    const pessoas = (conta.campos.pessoas ?? []) as {
      id?: string;
      email?: string;
      ativo?: boolean;
    }[];
    const pessoa = pessoas.find(
      (item) => item.id === antes.campos.contatoId && item.ativo !== false,
    );
    if (!pessoa)
      falha(
        'O contato selecionado foi removido ou inativado. Atualize a proposta e escolha outro.',
      );
    if (typeof pessoa.email !== 'string' || !pessoa.email.trim())
      falha(
        'O contato selecionado não tem e-mail cadastrado. Atualize a conta antes de continuar.',
      );
    return this.gravarAcao('propostas', id, usuario, antes, 'rascunho_email_solicitado', {
      rascunhoEmailContatoId: antes.campos.contatoId,
      rascunhoEmailSolicitadoEm: new Date(),
      rascunhoEmailSolicitadoPor: usuario.id,
    });
  }
  async criarQrTreinamento(id: string, usuario: UsuarioSessao) {
    const antes = await this.exigir('treinamentos', id, usuario);
    const token = randomBytes(32).toString('base64url');
    const inicio = Date.parse(String(antes.campos.dataInicio ?? ''));
    const fim = Date.parse(String(antes.campos.dataFim ?? antes.campos.dataInicio ?? ''));
    if (!Number.isFinite(inicio) || !Number.isFinite(fim))
      falha('Informe as datas do treinamento antes de gerar o QR.');
    const expira = new Date(fim + 24 * 60 * 60 * 1000);
    return this.gravarAcao(
      'treinamentos',
      id,
      usuario,
      antes,
      'gerar_qr',
      {
        tokenInscricaoHash: hmacDocumento(token),
        tokenInscricaoExpiraEm: expira,
      },
      { tokenInscricao: token, expiraEm: expira.toISOString() },
    );
  }
  async exportarParticipantes(
    id: string,
    formatoBruto: string | undefined,
    usuario: UsuarioSessao,
  ) {
    if (!GESTAO.includes(usuario.papel))
      falha('Somente gestor ou admin pode exportar participantes.', 'PAPEL_INSUFICIENTE', 403);
    const formato = formatoBruto === 'csv' || formatoBruto === 'xlsx' ? formatoBruto : '';
    if (!formato)
      falha('Informe formato=csv ou formato=xlsx. Nada foi exportado.', 'FORMATO_INVALIDO');
    const treinamento = await this.exigir('treinamentos', id, usuario);
    if (treinamento.arquivado) falha('O treinamento está arquivado. Restaure para exportar.');
    const MAX_LINHAS = 2000;
    const participantes = await this.registros
      .find({
        tipo: 'participantes',
        donoId: treinamento.donoId,
        arquivado: false,
        'campos.treinamentoId': String(treinamento._id),
      })
      .sort({ criadoEm: 1, _id: 1 })
      .limit(MAX_LINHAS + 1)
      .lean<Doc[]>();
    if (participantes.length > MAX_LINHAS)
      falha(
        `O limite é ${MAX_LINHAS} participantes por exportação. Filtre ou divida a lista.`,
        'EXPORTACAO_LIMITE',
        413,
      );
    const linhas = [
      ['Nome', 'Cargo', 'E-mail', 'Telefone', 'Situação', 'Confirmado', 'Presente', 'Inscrito em'],
      ...participantes.map((doc) => [
        textoCelula(doc.campos.nome),
        textoCelula(doc.campos.cargo),
        textoCelula(doc.campos.email),
        textoCelula(doc.campos.telefone),
        textoCelula(doc.campos.status),
        doc.campos.confirmado === true ? 'Sim' : 'Não',
        doc.campos.presente === true ? 'Sim' : 'Não',
        doc.criadoEm ? new Date(doc.criadoEm).toISOString() : '',
      ]),
    ];
    const corpo =
      formato === 'csv' ? Buffer.from(`\uFEFF${paraCsv(linhas)}`, 'utf8') : paraXlsx(linhas);
    const em = new Date();
    await this.conexao.collection('auditoria_exportacao').insertOne({
      autorId: usuario.id,
      papel: usuario.papel,
      formato,
      filtros: { secao: 'participantes', treinamentoId: String(treinamento._id) },
      quantidade: participantes.length,
      em,
    });
    return {
      corpo,
      tipo:
        formato === 'csv'
          ? 'text/csv; charset=utf-8'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      nome: `tela-viva-participantes-${String(treinamento._id)}.${formato}`,
    };
  }
  async relatorios(query: Record<string, unknown>, usuario: UsuarioSessao) {
    const permitidos = new Set(['de', 'ate', 'representanteId']);
    if (
      !query ||
      typeof query !== 'object' ||
      Array.isArray(query) ||
      Object.keys(query).some(
        (chave) => !permitidos.has(chave) || chave.startsWith('$') || chave.includes('.'),
      )
    )
      falha('Use apenas os filtros de e até, e representante quando permitido.');
    const de = dataDeRelatorio(query.de, 'de');
    dataDeRelatorio(query.ate, 'ate');
    const deTexto = query.de as string;
    const ateTexto = query.ate as string;
    if (deTexto > ateTexto) falha('A data inicial precisa ser anterior ou igual à data final.');
    const dias =
      (Date.parse(`${ateTexto}T00:00:00.000Z`) - Date.parse(`${deTexto}T00:00:00.000Z`)) /
        86_400_000 +
      1;
    if (dias > 366) falha('O relatório aceita janelas de até 366 dias.');
    const ateExclusivo = dataDeRelatorio(proximoDiaCalendario(ateTexto), 'ate');
    let representanteId: string | undefined;
    if (query.representanteId !== undefined) {
      if (!['gestor', 'admin'].includes(usuario.papel))
        falha('Somente gestor ou admin pode filtrar por representante.', 'PAPEL_INSUFICIENTE', 403);
      if (
        typeof query.representanteId !== 'string' ||
        !/^[a-f\d]{24}$/i.test(query.representanteId)
      )
        falha('Informe um identificador válido de representante.');
      representanteId = query.representanteId;
    }
    const dono = usuario.papel === 'vendedor' ? usuario.id : representanteId;
    const escopo = { arquivado: false, ...(dono ? { donoId: dono } : {}) };
    const criadosNoPeriodo = { $gte: de, $lt: ateExclusivo };
    const [atividadesBrutas, oportunidadesBrutas, propostasBrutas, treinamentos, participantes] =
      await Promise.all([
        this.registros.aggregate<{
          _id: { tipo: string | null; status: string | null };
          quantidade: number;
        }>([
          { $match: { ...escopo, tipo: 'atividades' } },
          {
            $set: {
              dataMarcada: {
                $convert: { input: '$campos.data', to: 'date', onError: null, onNull: null },
              },
            },
          },
          { $match: { dataMarcada: { $gte: de, $lt: ateExclusivo } } },
          {
            $group: {
              _id: { tipo: '$campos.tipo', status: '$campos.status' },
              quantidade: { $sum: 1 },
            },
          },
        ]),
        this.registros.aggregate<{ _id: string | null; quantidade: number; valorCentavos: number }>(
          [
            { $match: { ...escopo, tipo: 'oportunidades', criadoEm: criadosNoPeriodo } },
            {
              $group: {
                _id: '$campos.etapa',
                quantidade: { $sum: 1 },
                valorCentavos: { $sum: { $ifNull: ['$campos.valorCentavos', 0] } },
              },
            },
          ],
        ),
        this.registros.aggregate<{ _id: string | null; quantidade: number; totalCentavos: number }>(
          [
            { $match: { ...escopo, tipo: 'propostas', criadoEm: criadosNoPeriodo } },
            {
              $group: {
                _id: '$campos.status',
                quantidade: { $sum: 1 },
                totalCentavos: { $sum: { $ifNull: ['$campos.totalCentavos', 0] } },
              },
            },
          ],
        ),
        this.registros.countDocuments({
          ...escopo,
          tipo: 'treinamentos',
          criadoEm: criadosNoPeriodo,
        }),
        this.registros.aggregate<{
          _id: null;
          inscricoes: number;
          confirmados: number;
          presentes: number;
        }>([
          { $match: { ...escopo, tipo: 'participantes', criadoEm: criadosNoPeriodo } },
          {
            $group: {
              _id: null,
              inscricoes: { $sum: 1 },
              confirmados: {
                $sum: {
                  $cond: [
                    {
                      $or: [
                        { $eq: ['$campos.confirmado', true] },
                        { $in: ['$campos.status', ['confirmado', 'presente']] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              presentes: {
                $sum: {
                  $cond: [
                    {
                      $or: [
                        { $eq: ['$campos.presente', true] },
                        { $eq: ['$campos.status', 'presente'] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ]),
      ]);
    // Contatos capturados (QR, digitação, importação) por dia civil de São Paulo.
    // Vendedor vê só a própria carteira; gestor/admin pode filtrar por representante.
    const contatosPorDiaBrutos = await this.conexao
      .collection('contatos')
      .aggregate<{ _id: string; quantidade: number }>([
        {
          $match: {
            criadoEm: criadosNoPeriodo,
            ...(dono ? { 'origem.vendedorAtribuido': new Types.ObjectId(dono) } : {}),
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$criadoEm',
                timezone: 'America/Sao_Paulo',
              },
            },
            quantidade: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .toArray();
    const contatosPorDia = contatosPorDiaBrutos.map((grupo) => ({
      dia: grupo._id,
      quantidade: grupo.quantidade,
    }));
    const porTipo = new Map<string, number>();
    const porStatusAtividade = new Map<string, number>();
    for (const grupo of atividadesBrutas) {
      const tipo = grupo._id.tipo ?? 'nao_informado';
      const status = grupo._id.status ?? 'nao_informado';
      porTipo.set(tipo, (porTipo.get(tipo) ?? 0) + grupo.quantidade);
      porStatusAtividade.set(status, (porStatusAtividade.get(status) ?? 0) + grupo.quantidade);
    }
    const porEtapa = oportunidadesBrutas.map((grupo) => ({
      etapa: grupo._id ?? 'nao_informado',
      quantidade: grupo.quantidade,
      valorCentavos: grupo.valorCentavos,
    }));
    const pipelineCentavos = porEtapa
      .filter((grupo) => !['ganho', 'perdido'].includes(grupo.etapa))
      .reduce((total, grupo) => total + grupo.valorCentavos, 0);
    const porStatusProposta = propostasBrutas.map((grupo) => ({
      status: grupo._id ?? 'nao_informado',
      quantidade: grupo.quantidade,
      totalCentavos: grupo.totalCentavos,
    }));
    const em = new Date();
    const filtros = {
      de: deTexto,
      ate: ateTexto,
      ...(representanteId ? { representanteId } : {}),
    };
    const quantidadeRetornada =
      atividadesBrutas.reduce((n, item) => n + item.quantidade, 0) +
      oportunidadesBrutas.reduce((n, item) => n + item.quantidade, 0) +
      propostasBrutas.reduce((n, item) => n + item.quantidade, 0) +
      treinamentos +
      (participantes[0]?.inscricoes ?? 0);
    await this.conexao.collection('acessos_dados').insertOne({
      usuario: new Types.ObjectId(usuario.id),
      acao: 'relatorio_comercial',
      secao: 'relatorios',
      filtro: filtros,
      quantidadeRetornada,
      em,
    });
    return {
      periodo: filtros,
      baseJanela: {
        atividades: 'data marcada da atividade',
        demais: 'data de criação do registro',
      },
      atividades: {
        total: [...porTipo.values()].reduce((n, quantidade) => n + quantidade, 0),
        porTipo: [...porTipo].map(([tipo, quantidade]) => ({ tipo, quantidade })),
        porStatus: [...porStatusAtividade].map(([status, quantidade]) => ({ status, quantidade })),
      },
      oportunidades: {
        total: porEtapa.reduce((n, item) => n + item.quantidade, 0),
        pipelineCentavos,
        porEtapa,
      },
      propostas: {
        total: porStatusProposta.reduce((n, item) => n + item.quantidade, 0),
        totalCentavos: porStatusProposta.reduce((n, item) => n + item.totalCentavos, 0),
        porStatus: porStatusProposta,
      },
      treinamentos: { quantidade: treinamentos },
      contatos: {
        total: contatosPorDia.reduce((n, item) => n + item.quantidade, 0),
        porDia: contatosPorDia,
      },
      participantes: {
        inscricoes: participantes[0]?.inscricoes ?? 0,
        confirmados: participantes[0]?.confirmados ?? 0,
        presentes: participantes[0]?.presentes ?? 0,
      },
    };
  }
  async consultaPublicaTreinamento(token: string) {
    const doc = await this.encontrarTreinamentoPorToken(token);
    return {
      treinamento: {
        titulo: doc.campos.titulo,
        tipo: doc.campos.tipo,
        dataInicio: doc.campos.dataInicio,
        dataFim: doc.campos.dataFim,
        linkAcesso: doc.campos.linkAcesso,
        marca: doc.campos.marca,
        descricao: doc.campos.descricao,
      },
    };
  }
  async inscreverPublico(token: string, corpo: Record<string, unknown>, ip: string) {
    this.limitarInscricao(ip);
    const treinamento = await this.encontrarTreinamentoPorToken(token);
    const campos = sanitizar('participantes', corpo);
    if (!String(campos.nome ?? '').trim()) falha('Informe o nome para a inscrição.');
    if (!String(campos.email ?? '').trim())
      falha('Informe um e-mail para confirmar inscrição e evitar duplicidade.');
    const emailHash = hashEmailParticipante(campos.email);
    if (!emailHash) falha('Informe um e-mail válido para a inscrição.');
    const existente = await this.registros
      .findOne({
        tipo: 'participantes',
        donoId: treinamento.donoId,
        'campos.treinamentoId': String(treinamento._id),
        'campos.emailHash': emailHash,
      })
      .lean<Doc | null>();
    if (existente) return { inscricao: 'registrada', repetida: true };
    const agora = new Date();
    const dados = {
      ...PADROES.participantes,
      ...campos,
      treinamentoId: String(treinamento._id),
      emailHash,
      confirmado: false,
      presente: false,
      status: 'inscrito',
    };
    try {
      await this.registros.create({
        tipo: 'participantes',
        campos: dados,
        donoId: treinamento.donoId,
        versao: 1,
        arquivado: false,
        criadoEm: agora,
        alteradoEm: agora,
        criadoPor: 'inscricao-qr',
        alteradoPor: 'inscricao-qr',
        auditoria: [
          {
            acao: 'inscricao_publica',
            autor: 'inscricao-qr',
            em: agora,
            versao: 1,
            campos: ['nome', 'email', 'telefone', 'cargo'],
            resumoHash: hmacDocumento(JSON.stringify({ nome: campos.nome, emailHash })),
          },
        ],
      });
    } catch (erro) {
      if (erro && typeof erro === 'object' && 'code' in erro && erro.code === 11000)
        return { inscricao: 'registrada', repetida: true };
      throw erro;
    }
    return { inscricao: 'registrada', repetida: false };
  }
  private async encontrarTreinamentoPorToken(token: string): Promise<Doc> {
    if (typeof token !== 'string' || token.length > 100)
      falha('Este QR de treinamento não está ativo.', 'QR_INVALIDO', 404);
    const doc = await this.registros
      .findOne({
        tipo: 'treinamentos',
        arquivado: false,
        'campos.tokenInscricaoHash': hmacDocumento(token),
      })
      .lean<Doc | null>();
    if (
      !doc ||
      !doc.campos.tokenInscricaoExpiraEm ||
      Date.parse(String(doc.campos.tokenInscricaoExpiraEm)) < Date.now()
    )
      falha('Este QR de treinamento expirou ou foi desativado.', 'QR_EXPIRADO', 410);
    if (doc.campos.status === 'cancelado')
      falha('Este treinamento foi cancelado.', 'TREINAMENTO_CANCELADO', 410);
    if (doc.campos.status === 'concluido')
      falha('Este treinamento já foi concluído.', 'TREINAMENTO_ENCERRADO', 410);
    return doc;
  }
  private limitarInscricao(ip: string) {
    const agora = Date.now();
    const chave = ip || 'sem-ip';
    let faixa = this.limiteInscricao.get(chave);
    if (!faixa || agora - faixa.inicio >= 60_000) faixa = { inicio: agora, quantidade: 0 };
    faixa.quantidade += 1;
    this.limiteInscricao.set(chave, faixa);
    if (this.limiteInscricao.size > 5000) {
      for (const [id, valor] of this.limiteInscricao)
        if (agora - valor.inicio > 60_000) this.limiteInscricao.delete(id);
    }
    if (faixa.quantidade > 10)
      falha('Muitas tentativas. Aguarde um minuto e tente novamente.', 'LIMITE_INSCRICAO', 429);
  }
  private async donoDoRegistro(
    tipo: TipoComercial,
    campos: Record<string, unknown>,
    usuario: UsuarioSessao,
  ) {
    if (tipo === 'contas' || tipo === 'produtos') return usuario.id;
    if (tipo === 'participantes') {
      const evento = await this.exigir('treinamentos', String(campos.treinamentoId ?? ''), usuario);
      if (evento.arquivado) falha('Este treinamento está arquivado.');
      return evento.donoId;
    }
    if (tipo === 'treinamentos' && campos.oportunidadeId) {
      const oportunidade = await this.exigir(
        'oportunidades',
        String(campos.oportunidadeId),
        usuario,
      );
      return oportunidade.donoId;
    }
    if (tipo === 'precosCliente' || campos.contaId)
      return (await this.exigir('contas', String(campos.contaId ?? ''), usuario)).donoId;
    return usuario.id;
  }
  private async validarEquipeAtiva(campos: Record<string, unknown>): Promise<void> {
    const ids = [
      ...(typeof campos.responsavelId === 'string' ? [campos.responsavelId] : []),
      ...(Array.isArray(campos.colaboradoresIds)
        ? (campos.colaboradoresIds as unknown[]).filter(
            (id): id is string => typeof id === 'string',
          )
        : []),
    ];
    const unicos = [...new Set(ids)];
    if (!unicos.length) return;
    const objectIds = unicos.map((id) => new Types.ObjectId(id));
    const usuarios = await this.conexao
      .collection('usuarios')
      .find(
        {
          _id: { $in: objectIds },
          ativo: { $ne: false },
          papel: { $in: ['vendedor', 'gestor', 'admin'] },
        },
        { projection: { _id: 1 } },
      )
      .toArray();
    const validos = new Set(usuarios.map((doc) => String(doc._id)));
    if (unicos.some((id) => !validos.has(id)))
      falha(
        'Selecione apenas membros existentes e ativos da equipe comercial. Auditores não podem ser atribuídos.',
        'EQUIPE_INVALIDA',
      );
  }
  private async gravarAcao(
    tipo: TipoComercial,
    id: string,
    usuario: UsuarioSessao,
    antes: Doc,
    acao: string,
    alteracoes: Record<string, unknown>,
    retornoExtra: Record<string, unknown> = {},
  ) {
    if (antes.auditoria.length >= 5000)
      falha('Este registro atingiu o limite de alterações.', 'LIMITE_AUDITORIA', 409);
    const campos = { ...antes.campos, ...alteracoes };
    const agora = new Date();
    const salvo = await this.registros
      .findOneAndUpdate(
        { ...this.escopo(tipo, usuario), _id: id, versao: antes.versao },
        {
          $set: { campos, alteradoEm: agora, alteradoPor: usuario.id },
          $inc: { versao: 1 },
          $push: { auditoria: evento(acao, usuario, antes.versao + 1, alteracoes, agora) },
        },
        { new: true },
      )
      .lean<Doc | null>();
    if (!salvo)
      falha('Outra alteração foi gravada primeiro. Atualize a tela.', 'CONFLITO_VERSAO', 409);
    return { registro: vista(salvo), ...retornoExtra };
  }
  private async exigir(tipo: TipoComercial, id: string, usuario: UsuarioSessao): Promise<Doc> {
    this.exigirAcessoSecao(tipo, usuario);
    if (!Types.ObjectId.isValid(id)) falha('Não encontrei este registro.', 'REGISTRO_AUSENTE', 404);
    const doc = await this.registros
      .findOne({ ...this.escopo(tipo, usuario), _id: id })
      .lean<Doc | null>();
    if (!doc) falha('Não encontrei este registro na sua carteira.', 'REGISTRO_AUSENTE', 404);
    return doc as Doc;
  }
  private exigirAcessoSecao(tipo: TipoComercial, usuario: UsuarioSessao): void {
    if (tipo === 'participantes' && usuario.papel === 'auditor')
      falha(
        'O perfil auditor não pode consultar dados pessoais de participantes.',
        'PAPEL_INSUFICIENTE',
        403,
      );
  }
  private async checarReferencias(
    tipo: TipoComercial,
    campos: Record<string, unknown>,
    usuario: UsuarioSessao,
    donoId = usuario.id,
  ): Promise<void> {
    if (tipo === 'contas' || tipo === 'produtos') return;
    let conta: Doc | undefined;
    if (campos.contaId) {
      conta = await this.exigir('contas', String(campos.contaId), usuario);
      if (conta.arquivado) falha('Esta conta está arquivada. Restaure antes de vinculá-la.');
      if (conta.donoId !== donoId)
        falha('A conta e o registro precisam pertencer ao mesmo representante.');
    }
    if (campos.oportunidadeId) {
      const oportunidade = await this.exigir(
        'oportunidades',
        String(campos.oportunidadeId),
        usuario,
      );
      if (oportunidade.arquivado || oportunidade.donoId !== donoId)
        falha('Escolha uma oportunidade ativa do mesmo representante.');
      if (campos.contaId && oportunidade.campos.contaId !== campos.contaId)
        falha('A oportunidade precisa pertencer à conta selecionada.');
    }
    if (tipo === 'precosCliente') {
      const produto = await this.exigir('produtos', String(campos.produtoId ?? ''), usuario);
      if (produto.arquivado)
        falha('Este produto está arquivado. Restaure antes de negociar o preço.');
    }
    if (tipo === 'participantes') {
      const treinamento = await this.exigir(
        'treinamentos',
        String(campos.treinamentoId ?? ''),
        usuario,
      );
      if (treinamento.arquivado || treinamento.donoId !== donoId)
        falha('Escolha um treinamento ativo da mesma carteira.');
    }
    if (tipo === 'propostas' && campos.contatoId && !campos.contaId)
      falha('Escolha a conta antes de selecionar o contato da proposta.');
    if (tipo === 'propostas' && campos.contaId && campos.contatoId) {
      const pessoas = (conta?.campos.pessoas ?? []) as { id?: string; ativo?: boolean }[];
      if (!pessoas.some((pessoa) => pessoa.id === campos.contatoId && pessoa.ativo !== false))
        falha('Escolha um contato ativo desta conta para a proposta.');
    }
    if (tipo === 'propostas') {
      for (const item of (campos.itens ?? []) as { produtoId?: string }[]) {
        if (!item.produtoId) continue;
        const produto = await this.exigir('produtos', item.produtoId, usuario);
        if (produto.arquivado)
          falha('Um produto da proposta está arquivado. Escolha outro produto.');
      }
    }
  }
  async painel(usuario: UsuarioSessao) {
    const dono = usuario.papel === 'vendedor' ? { donoId: usuario.id } : {};
    const base = { ...dono, arquivado: false };
    const agora = new Date();
    const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' });
    const hoje = dia.format(agora);
    const [contagens, funilBruto, atividadesResumo, proximas, contas, propostas] =
      await Promise.all([
        this.registros.aggregate<{ _id: string; quantidade: number }>([
          { $match: base },
          { $group: { _id: '$tipo', quantidade: { $sum: 1 } } },
        ]),
        this.registros.aggregate<{ _id: string; quantidade: number; valorCentavos: number }>([
          { $match: { ...base, tipo: 'oportunidades' } },
          {
            $group: {
              _id: '$campos.etapa',
              quantidade: { $sum: 1 },
              valorCentavos: { $sum: '$campos.valorCentavos' },
            },
          },
        ]),
        this.registros.aggregate<{ visitasHoje: number; pendentes: number; atrasadas: number }>([
          { $match: { ...base, tipo: 'atividades' } },
          {
            $set: {
              dataAtividade: {
                $convert: { input: '$campos.data', to: 'date', onError: null, onNull: null },
              },
            },
          },
          {
            $group: {
              _id: null,
              visitasHoje: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $eq: ['$campos.tipo', 'visita'] },
                        { $ne: ['$campos.status', 'cancelada'] },
                        {
                          $eq: [
                            {
                              $dateToString: {
                                date: '$dataAtividade',
                                format: '%Y-%m-%d',
                                timezone: 'America/Sao_Paulo',
                                onNull: '',
                              },
                            },
                            hoje,
                          ],
                        },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              pendentes: { $sum: { $cond: [{ $eq: ['$campos.status', 'planejada'] }, 1, 0] } },
              atrasadas: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $eq: ['$campos.status', 'planejada'] },
                        { $ne: ['$dataAtividade', null] },
                        { $lt: ['$dataAtividade', agora] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ]),
        this.registros
          .find({
            ...base,
            tipo: 'atividades',
            'campos.status': 'planejada',
            'campos.data': { $type: 'string' },
          })
          .select('-auditoria')
          .sort({ 'campos.data': 1, _id: 1 })
          .limit(8)
          .lean<Doc[]>(),
        this.registros
          .find({ ...base, tipo: 'contas' })
          .select('-auditoria')
          .sort({ alteradoEm: -1 })
          .limit(6)
          .lean<Doc[]>(),
        this.registros.countDocuments({
          ...base,
          tipo: 'propostas',
          'campos.status': { $in: ['rascunho', 'apresentada'] },
        }),
      ]);
    const funil = ETAPAS.map((etapa) => {
      const linha = funilBruto.find((r) => r._id === etapa);
      return {
        etapa,
        quantidade: linha?.quantidade ?? 0,
        valorCentavos: linha?.valorCentavos ?? 0,
      };
    });
    const abertas = funil.filter((r) => !['ganho', 'perdido'].includes(r.etapa));
    const atividades = atividadesResumo[0];
    return {
      indicadores: {
        contas: contagens.find((r) => r._id === 'contas')?.quantidade ?? 0,
        oportunidadesAbertas: abertas.reduce((n, r) => n + r.quantidade, 0),
        pipelineCentavos: abertas.reduce((n, r) => n + r.valorCentavos, 0),
        ganhoCentavos: funil.find((r) => r.etapa === 'ganho')?.valorCentavos ?? 0,
        visitasHoje: atividades?.visitasHoje ?? 0,
        atividadesPendentes: atividades?.pendentes ?? 0,
        atrasadas: atividades?.atrasadas ?? 0,
        propostasAbertas: propostas,
      },
      funil,
      proximasAtividades: proximas.map(vista),
      contasRecentes: contas.map(vista),
    };
  }
}
function inteiroQuery(valor: string | undefined, padrao: number, min: number, max: number): number {
  if (valor === undefined) return padrao;
  const n = typeof valor === 'string' && /^\d+$/.test(valor) ? Number(valor) : NaN;
  if (!Number.isSafeInteger(n) || n < min || n > max)
    falha('Paginação inválida. Use os controles da lista.');
  return n;
}
function hashEmailParticipante(valor: unknown): string | undefined {
  if (typeof valor !== 'string' || !valor.trim()) return undefined;
  return hmacDocumento(valor.trim().toLowerCase());
}
function isDuplicateKey(erro: unknown): boolean {
  return Boolean(erro && typeof erro === 'object' && 'code' in erro && erro.code === 11000);
}
function validarJanelaTreinamento(campos: Record<string, unknown>): void {
  const fim = campos.dataFim;
  if (fim === undefined || fim === null || fim === '') return;
  const inicio = campos.dataInicio;
  if (
    typeof inicio !== 'string' ||
    typeof fim !== 'string' ||
    !Number.isFinite(Date.parse(inicio)) ||
    !Number.isFinite(Date.parse(fim))
  )
    falha('Informe datas válidas de início e fim do treinamento.');
  if (Date.parse(fim) < Date.parse(inicio))
    falha('O fim do treinamento precisa ser posterior ao início.');
}
function dataDeRelatorio(valor: unknown, campo: 'de' | 'ate'): Date {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor))
    falha(`Informe ${campo} no formato AAAA-MM-DD.`);
  const dataUtc = new Date(`${valor}T00:00:00.000Z`);
  if (!Number.isFinite(dataUtc.getTime()) || dataUtc.toISOString().slice(0, 10) !== valor)
    falha(`Informe uma data de calendário válida para ${campo}.`);
  return inicioDoDiaEmSaoPaulo(dataUtc);
}
function proximoDiaCalendario(data: string): string {
  const proximo = new Date(`${data}T00:00:00.000Z`);
  proximo.setUTCDate(proximo.getUTCDate() + 1);
  return proximo.toISOString().slice(0, 10);
}
function inicioDoDiaEmSaoPaulo(dataUtc: Date): Date {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const alvo = {
    ano: dataUtc.getUTCFullYear(),
    mes: dataUtc.getUTCMonth() + 1,
    dia: dataUtc.getUTCDate(),
  };
  const alvoComoUtc = Date.UTC(alvo.ano, alvo.mes - 1, alvo.dia);
  let instante = alvoComoUtc;
  for (let tentativa = 0; tentativa < 4; tentativa += 1) {
    const partes = Object.fromEntries(
      formatter.formatToParts(new Date(instante)).map((p) => [p.type, p.value]),
    );
    const localComoUtc = Date.UTC(
      Number(partes.year),
      Number(partes.month) - 1,
      Number(partes.day),
      Number(partes.hour),
      Number(partes.minute),
      Number(partes.second),
    );
    const offset = localComoUtc - instante;
    const ajustado = alvoComoUtc - offset;
    if (ajustado === instante) break;
    instante = ajustado;
  }
  // Se a zona avançar o relógio exatamente à meia-noite, use o primeiro
  // instante existente ainda dentro do dia civil solicitado.
  for (let minuto = 0; minuto <= 180; minuto += 1) {
    const candidato = instante + minuto * 60_000;
    const partes = formatter.formatToParts(new Date(candidato));
    const mapa = Object.fromEntries(partes.map((p) => [p.type, p.value]));
    const chaveLocal = `${mapa.year}-${mapa.month}-${mapa.day}`;
    const chaveAlvo = `${String(alvo.ano).padStart(4, '0')}-${String(alvo.mes).padStart(2, '0')}-${String(alvo.dia).padStart(2, '0')}`;
    if (chaveLocal === chaveAlvo) return new Date(candidato);
    if (chaveLocal > chaveAlvo) break;
  }
  falha('Não foi possível determinar o início do dia no fuso America/Sao_Paulo.');
}
function filtrosDeAuditoria(query: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    FILTROS_AUDITAVEIS.flatMap((chave) => {
      const valor = query[chave];
      return typeof valor === 'string' && valor.length <= 100 ? [[chave, valor]] : [];
    }),
  );
}
function textoCelula(valor: unknown): string {
  let texto = '';
  for (const caractere of String(valor ?? '')) {
    const codigo = caractere.codePointAt(0) ?? 0;
    if (
      (codigo >= 0 && codigo <= 8) ||
      codigo === 11 ||
      codigo === 12 ||
      (codigo >= 14 && codigo <= 31) ||
      codigo === 0xfffe ||
      codigo === 0xffff
    )
      continue;
    texto += caractere;
  }
  return texto;
}
function vista(doc: Doc) {
  const campos = { ...doc.campos };
  // Nunca expor identificadores derivados de e-mail nem o digest do token, mesmo autenticado.
  delete campos.tokenInscricaoHash;
  delete campos.emailHash;
  return {
    ...campos,
    _id: String(doc._id),
    secao: doc.tipo,
    donoId: doc.donoId,
    versao: doc.versao,
    criadoEm: doc.criadoEm,
    alteradoEm: doc.alteradoEm,
    criadoPor: doc.criadoPor,
    alteradoPor: doc.alteradoPor,
    arquivado: doc.arquivado,
  };
}
function evento(
  acao: string,
  usuario: UsuarioSessao,
  versao: number,
  campos: Record<string, unknown>,
  em: Date,
): EventoComercial {
  return {
    acao,
    autor: hmacDocumento(usuario.id),
    em,
    versao,
    campos: Object.keys(campos),
    resumoHash: hmacDocumento(JSON.stringify(campos)),
  };
}

/** O que a conta espelha da ficha do contato. Vazio não apaga o que a conta já tinha. */
function camposDoContato(contatoId: string, c: Record<string, unknown>): Record<string, unknown> {
  const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const principal = <T extends { principal?: boolean }>(lista: unknown): T | undefined => {
    const itens = Array.isArray(lista) ? (lista as T[]) : [];
    return itens.find((x) => x.principal) ?? itens[0];
  };
  const email = principal<{ valor?: string; principal?: boolean }>(c.emails);
  const telefone = principal<{ e164?: string; bruto?: string; principal?: boolean }>(c.telefones);
  const endereco = (Array.isArray(c.enderecos) ? c.enderecos[0] : undefined) as
    { cidade?: string; uf?: string } | undefined;
  const segmento =
    c.tipoPessoa === 'PJ'
      ? 'estudio_tatuagem'
      : c.tipoPessoa === 'PF'
        ? 'profissional_autonomo'
        : '';
  const campos: Record<string, unknown> = {
    contatoOrigemId: contatoId,
    nome: texto(c.nome) || 'Contato sem nome',
    contatoNome: texto(c.nome),
    contatoEmail: texto(email?.valor),
    contatoTelefone: texto(telefone?.e164) || texto(telefone?.bruto),
    cidade: texto(endereco?.cidade),
    uf: texto(endereco?.uf).toUpperCase(),
    ...(segmento ? { segmento } : {}),
  };
  for (const k of Object.keys(campos)) if (campos[k] === '') delete campos[k];
  return campos;
}
