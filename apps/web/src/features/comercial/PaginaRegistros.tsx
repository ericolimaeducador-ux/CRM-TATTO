import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import {
  apiComercial,
  ErroComercial,
  dataFormatada,
  contatoDaProposta,
  ETAPAS,
  moeda,
  nomeRegistro,
  podeEscrever,
  rotulo,
  rascunhoEmailProposta,
  temSessao,
  todasReferencias,
  useComercial,
  useEquipe,
  descricaoUsuario,
  type Lista,
  type Registro,
  type Secao,
  type UsuarioComercial,
} from './api';
import { AvisoDados, CabecalhoPagina, Icone, Selo, Vazio } from './componentes';
import { EditorRegistro, Modal } from './EditorRegistro';

const CONFIG: Record<
  Secao,
  { titulo: string; descricao: string; nova: string; singular: string; icone: string }
> = {
  contas: {
    titulo: 'Minha carteira',
    descricao: 'Conheça cada conta. Cuide de cada relacionamento.',
    nova: 'Nova conta',
    singular: 'conta',
    icone: 'contas',
  },
  atividades: {
    titulo: 'Agenda de visitas',
    descricao: 'Transforme seus próximos encontros em boas conversas.',
    nova: 'Agendar visita',
    singular: 'atividade',
    icone: 'agenda',
  },
  oportunidades: {
    titulo: 'Oportunidades',
    descricao: 'Acompanhe cada conversa, da aproximação à parceria.',
    nova: 'Nova oportunidade',
    singular: 'oportunidade',
    icone: 'funil',
  },
  produtos: {
    titulo: 'Produtos representados',
    descricao: 'Seu portfólio comercial, pronto para a próxima visita.',
    nova: 'Novo produto',
    singular: 'produto',
    icone: 'produtos',
  },
  propostas: {
    titulo: 'Propostas comerciais',
    descricao: 'Dê forma às oportunidades com clareza em cada detalhe.',
    nova: 'Nova proposta',
    singular: 'proposta',
    icone: 'propostas',
  },
};
function statusOpcoes(secao: Secao) {
  return secao === 'atividades'
    ? ['planejada', 'concluida', 'cancelada']
    : secao === 'propostas'
      ? ['rascunho', 'apresentada', 'aceita', 'recusada']
      : secao === 'contas'
        ? ['prospect', 'ativo', 'inativo']
        : [];
}
export function PaginaRegistros({ secao }: { secao: Secao }) {
  const [params, setParams] = useSearchParams();
  const [editor, setEditor] = useState<Registro | 'novo' | null>(null);
  const [visualizar, setVisualizar] = useState<Registro | null>(null);
  const [confirmando, setConfirmando] = useState<Registro | null>(null);
  const [impressao, setImpressao] = useState<Registro | null>(null);
  const [mensagem, setMensagem] = useState('');
  const [erroAcao, setErroAcao] = useState('');
  const [ocupado, setOcupado] = useState('');
  const [contas, setContas] = useState<Registro[]>([]);
  const [rascunhoOcupado, setRascunhoOcupado] = useState(false);
  const [erroRascunho, setErroRascunho] = useState('');
  const [mensagemRascunho, setMensagemRascunho] = useState('');
  const config = CONFIG[secao];
  const escrita = podeEscrever(secao);
  const equipe = useEquipe(secao === 'atividades' && escrita);
  const pagina = Math.max(1, Number(params.get('pagina')) || 1);
  const arquivados = params.get('arquivados') === 'true';
  const busca = params.get('q') ?? '';
  const status = params.get('status') ?? '';
  const etapa = params.get('etapa') ?? '';
  const trilha = params.get('trilha') ?? '';
  const query = new URLSearchParams({
    pagina: String(pagina),
    limite: '30',
    ...(busca ? { q: busca } : {}),
    ...(status ? { status } : {}),
    ...(etapa ? { etapa } : {}),
    ...(trilha ? { trilha } : {}),
    ...(arquivados ? { arquivados: 'true' } : {}),
    ...(params.get('contaId') ? { contaId: params.get('contaId') ?? '' } : {}),
  });
  const lista = useComercial<Lista>(`/${secao}?${query.toString()}`);
  useEffect(() => {
    setErroRascunho('');
    setMensagemRascunho('');
  }, [visualizar?._id]);
  async function solicitarRascunho() {
    if (!visualizar || rascunhoOcupado) return;
    const proposta = visualizar;
    let registrada = false;
    setRascunhoOcupado(true);
    setErroRascunho('');
    setMensagemRascunho('');
    try {
      const { registro } = await apiComercial<{ registro: Registro }>(
        `/propostas/${proposta._id}/rascunho-email`,
        'POST',
        { versao: proposta.versao },
      );
      registrada = true;
      setVisualizar(registro);
      const { registro: contaAtual } = await apiComercial<{ registro: Registro }>(
        `/contas/${registro.contaId}`,
      );
      setContas((atuais) => [...atuais.filter((c) => c._id !== contaAtual._id), contaAtual]);
      const href = rascunhoEmailProposta(registro, contaAtual);
      if (!href)
        throw new Error(
          'O contato selecionado está indisponível, inativo ou sem e-mail. Atualize a conta e escolha um contato ativo antes de tentar novamente.',
        );
      setMensagemRascunho(
        'Rascunho solicitado e registrado. O cliente de e-mail será aberto para sua revisão.',
      );
      lista.atualizar();
      try {
        window.location.assign(href);
      } catch {
        throw new Error(
          'O navegador não conseguiu abrir o cliente de e-mail. Verifique se há um aplicativo de e-mail configurado neste aparelho.',
        );
      }
    } catch (e) {
      const mensagem =
        e instanceof Error ? e.message : 'Não foi possível solicitar o rascunho agora.';
      setErroRascunho(
        e instanceof ErroComercial && e.status === 409
          ? `${mensagem} A proposta continua aberta. Consulte a versão atual antes de solicitar o rascunho novamente.`
          : registrada
            ? `A solicitação foi registrada, mas o cliente de e-mail não foi aberto. ${mensagem}`
            : `O rascunho não foi aberto. ${mensagem}`,
      );
    } finally {
      setRascunhoOcupado(false);
    }
  }
  async function atualizarPropostaAberta() {
    if (!visualizar || rascunhoOcupado) return;
    setRascunhoOcupado(true);
    try {
      const { registro } = await apiComercial<{ registro: Registro }>(
        `/propostas/${visualizar._id}`,
      );
      setVisualizar(registro);
      if (registro.contaId) {
        const { registro: contaAtual } = await apiComercial<{ registro: Registro }>(
          `/contas/${registro.contaId}`,
        );
        setContas((atuais) => [...atuais.filter((c) => c._id !== contaAtual._id), contaAtual]);
      }
      setErroRascunho('');
      setMensagemRascunho(
        'Versão atual da proposta consultada. Confira o contato antes de solicitar o rascunho.',
      );
      lista.atualizar();
    } catch (e) {
      setErroRascunho(
        e instanceof Error
          ? e.message
          : 'Não consegui consultar a versão atual. A proposta continua aberta.',
      );
    } finally {
      setRascunhoOcupado(false);
    }
  }
  const nomeConta = (id?: string) =>
    contas.find((c) => c._id === id)?.nome || (id ? 'Conta vinculada' : 'Sem conta vinculada');
  const alterarFiltro = (chave: string, valor: string) => {
    const novos = new URLSearchParams(params);
    if (valor) novos.set(chave, valor);
    else novos.delete(chave);
    novos.delete('pagina');
    setParams(novos, { replace: true });
  };
  useEffect(() => {
    if (secao === 'contas' || !temSessao()) return;
    let vivo = true;
    void todasReferencias('contas')
      .then((r) => {
        if (vivo) setContas(r);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [secao]);
  useEffect(() => {
    const novo = params.get('novo');
    const id = params.get('editar');
    if (!novo && !id) return;
    if ((novo && !escrita) || !temSessao()) return;
    const novos = new URLSearchParams(params);
    novos.delete('novo');
    novos.delete('editar');
    setParams(novos, { replace: true });
    if (novo) setEditor('novo');
    else if (id)
      void apiComercial<{ registro: Registro }>(`/${secao}/${id}`)
        .then(({ registro }) => {
          if (escrita) setEditor(registro);
          else setVisualizar(registro);
        })
        .catch((e: unknown) =>
          setErroAcao(e instanceof Error ? e.message : 'Não consegui abrir o registro.'),
        );
  }, [params, secao, setParams, escrita]);
  async function arquivar() {
    if (!confirmando) return;
    setOcupado(confirmando._id);
    setErroAcao('');
    try {
      await apiComercial(`/${secao}/${confirmando._id}`, 'PATCH', {
        versao: confirmando.versao,
        arquivado: !confirmando.arquivado,
      });
      setMensagem(
        confirmando.arquivado
          ? 'Registro restaurado na carteira.'
          : 'Registro arquivado. Você pode restaurá-lo em Arquivados.',
      );
      setConfirmando(null);
      lista.atualizar();
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : 'Não foi possível alterar o registro.');
    } finally {
      setOcupado('');
    }
  }
  async function mudarEtapa(r: Registro, valor: string) {
    setOcupado(r._id);
    setErroAcao('');
    try {
      await apiComercial(`/${secao}/${r._id}`, 'PATCH', { versao: r.versao, etapa: valor });
      setMensagem(`Etapa confirmada: ${rotulo(valor)}.`);
      lista.atualizar();
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : 'A etapa não foi alterada.');
    } finally {
      setOcupado('');
    }
  }
  const imprimir = (r: Registro) => {
    setImpressao(r);
    window.setTimeout(() => window.print(), 100);
  };
  const acoes = (r: Registro) => (
    <div className="tv-row-actions">
      <button
        className="tv-small-button"
        onClick={() => setVisualizar(r)}
        aria-label={`Abrir ${nomeRegistro(r)}`}
      >
        Abrir
      </button>
      {escrita ? (
        <>
          <button
            className="tv-icon-button"
            aria-label={`Editar ${nomeRegistro(r)}`}
            onClick={() => setEditor(r)}
          >
            <Icone nome="propostas" tamanho={17} />
          </button>
          <button className="tv-small-button" onClick={() => setConfirmando(r)}>
            {r.arquivado ? 'Restaurar' : 'Arquivar'}
          </button>
        </>
      ) : null}
    </div>
  );
  const registros = lista.dados?.registros ?? [];
  const pronto = temSessao() && !lista.carregando && !lista.erro && lista.dados;
  return (
    <div className="tv-page">
      <CabecalhoPagina
        titulo={config.titulo}
        descricao={config.descricao}
        acao={
          secao === 'contas' ? (
            <Link className="tv-button tv-button-primary" to="/contatos">
              <Icone nome="contatos" />
              Qualificar contatos
            </Link>
          ) : escrita ? (
            <button className="tv-button tv-button-primary" onClick={() => setEditor('novo')}>
              <Icone nome="mais" />
              {config.nova}
            </button>
          ) : undefined
        }
      />
      {secao === 'contas' ? (
        <p className="tv-campaign-hint">
          A carteira se forma sozinha: quando um contato é qualificado, ele entra aqui com nome,
          WhatsApp, e-mail, cidade e tipo da ficha. Para incluir alguém, qualifique o contato em{' '}
          <Link to="/contatos">Contatos</Link>.
        </p>
      ) : null}
      <AvisoDados erro={lista.erro} carregando={lista.carregando} atualizar={lista.atualizar} />
      {secao === 'produtos' ? (
        <aside className="tv-product-note">
          <Icone nome="produtos" tamanho={25} />
          <div>
            <strong>Tela Viva · representante oficial Pele Rara®</strong>
            <p>
              O Kit Tattoo reúne a Espuma Facial de Sensação Ultra-Leve 150 ml (BioBloc) e o
              Hidratante Concentrado 60 g (BioCic®). Cadastre o portfólio com os preços e condições
              comerciais confirmados pela gestão.
            </p>
          </div>
        </aside>
      ) : null}
      {mensagem ? (
        <div className="tv-success" role="status">
          <Icone nome="check" />
          {mensagem}
          <button
            className="tv-icon-button"
            aria-label="Fechar mensagem"
            onClick={() => setMensagem('')}
          >
            <Icone nome="fechar" tamanho={16} />
          </button>
        </div>
      ) : null}
      {erroAcao ? (
        <div className="tv-inline-error" role="alert">
          {erroAcao}
          <button
            className="tv-small-button"
            onClick={() => {
              lista.atualizar();
              setErroAcao('');
            }}
          >
            Atualizar lista
          </button>
        </div>
      ) : null}
      <section className="tv-panel tv-records-panel">
        <div className="tv-list-toolbar">
          <div className="tv-list-tabs">
            <button
              className={!arquivados ? 'active' : ''}
              onClick={() => alterarFiltro('arquivados', '')}
            >
              Ativos
            </button>
            <button
              className={arquivados ? 'active' : ''}
              onClick={() => alterarFiltro('arquivados', 'true')}
            >
              Arquivados
            </button>
          </div>
          <div className="tv-list-filters">
            <label className="tv-search-field">
              <Icone nome="busca" tamanho={18} />
              <input
                aria-label={`Buscar ${config.titulo.toLowerCase()}`}
                placeholder="Buscar por nome, conta, território…"
                value={busca}
                onChange={(e) => alterarFiltro('q', e.target.value)}
              />
            </label>
            {statusOpcoes(secao).length ? (
              <select
                aria-label="Filtrar por situação"
                value={status}
                onChange={(e) => alterarFiltro('status', e.target.value)}
              >
                <option value="">Todas as situações</option>
                {statusOpcoes(secao).map((s) => (
                  <option value={s} key={s}>
                    {rotulo(s)}
                  </option>
                ))}
              </select>
            ) : null}
            {secao === 'contas' ? (
              <select
                aria-label="Filtrar por caminho"
                value={trilha}
                onChange={(e) => alterarFiltro('trilha', e.target.value)}
              >
                <option value="">Todos os caminhos</option>
                <option value="funil">Funil</option>
                <option value="nutrir">Nutrir</option>
                <option value="adormecido">Adormecido</option>
              </select>
            ) : null}
            {secao === 'oportunidades' ? (
              <select
                aria-label="Filtrar por etapa"
                value={etapa}
                onChange={(e) => alterarFiltro('etapa', e.target.value)}
              >
                <option value="">Todas as etapas</option>
                {ETAPAS.map((s) => (
                  <option value={s} key={s}>
                    {rotulo(s)}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        </div>
        {pronto && !registros.length ? (
          <Vazio
            titulo={
              arquivados
                ? 'Nenhum registro arquivado.'
                : busca || status || etapa
                  ? 'Nenhum resultado para esta seleção.'
                  : secao === 'contas'
                    ? 'Nenhum contato qualificado ainda.'
                    : 'Um novo capítulo para sua rotina.'
            }
            texto={
              arquivados
                ? 'Os registros arquivados aparecerão aqui para consulta ou restauração.'
                : busca || status || etapa
                  ? 'Experimente outra busca ou remova os filtros.'
                  : secao === 'contas'
                    ? 'Abra um lead em Contatos, complete cidade, UF e tipo e clique em Qualificar. Ele aparece aqui na hora.'
                    : 'Comece com uma informação. Complete os detalhes conforme o relacionamento cresce.'
            }
            acao={
              secao === 'contas' && !arquivados ? (
                <Link className="tv-button tv-button-light" to="/contatos">
                  <Icone nome="contatos" />
                  Ir para Contatos
                </Link>
              ) : escrita && !arquivados ? (
                <button className="tv-button tv-button-light" onClick={() => setEditor('novo')}>
                  <Icone nome="mais" />
                  {config.nova}
                </button>
              ) : undefined
            }
          />
        ) : null}
        {pronto && registros.length && secao === 'oportunidades' ? (
          <>
            <p className="tv-board-caption">
              {lista.dados?.total} oportunidades · Valores em reais · Use a etapa de cada cartão
              para movimentar o funil.
            </p>
            <div className="tv-kanban">
              {ETAPAS.filter((e) => !etapa || e === etapa).map((e) => {
                const grupo = registros.filter((r) => r.etapa === e);
                return (
                  <section className={`tv-kanban-column tv-stage-${e}`} key={e}>
                    <header>
                      <span>
                        <i />
                        {rotulo(e)}
                      </span>
                      <b>{grupo.length}</b>
                    </header>
                    <small>
                      {moeda(grupo.reduce((n, r) => n + (r.valorCentavos ?? 0), 0))} nesta página
                    </small>
                    {grupo.map((r) => (
                      <article className="tv-deal-card" key={r._id}>
                        <span className="tv-deal-company">{nomeConta(r.contaId)}</span>
                        <h3>
                          <button onClick={() => setVisualizar(r)}>{nomeRegistro(r)}</button>
                        </h3>
                        <strong>{moeda(r.valorCentavos)}</strong>
                        {r.proximaAcao ? <p>{r.proximaAcao}</p> : <p>Defina a próxima ação.</p>}
                        <div className="tv-deal-date">
                          <Icone nome="agenda" tamanho={15} />
                          {dataFormatada(r.previsao)}
                        </div>
                        {escrita && !r.arquivado ? (
                          <select
                            value={r.etapa}
                            disabled={ocupado === r._id}
                            aria-label={`Etapa de ${nomeRegistro(r)}`}
                            onChange={(ev) => void mudarEtapa(r, ev.target.value)}
                          >
                            {ETAPAS.map((s) => (
                              <option key={s} value={s}>
                                {rotulo(s)}
                              </option>
                            ))}
                          </select>
                        ) : null}
                        {acoes(r)}
                      </article>
                    ))}
                    {!grupo.length ? (
                      <div className="tv-kanban-empty">Nenhuma oportunidade nesta página.</div>
                    ) : null}
                  </section>
                );
              })}
            </div>
          </>
        ) : null}
        {pronto && registros.length && secao === 'atividades' ? (
          <div className="tv-agenda-list">
            {[...registros]
              .sort((a, b) => (a.data ?? '9999').localeCompare(b.data ?? '9999'))
              .map((r) => {
                const d = r.data ? new Date(r.data) : null;
                return (
                  <article
                    className={`tv-agenda-item ${r.status === 'concluida' ? 'is-done' : ''}`}
                    key={r._id}
                  >
                    <div className="tv-agenda-date">
                      <strong>{d ? d.getDate().toString().padStart(2, '0') : '—'}</strong>
                      <span>
                        {d ? d.toLocaleDateString('pt-BR', { month: 'short' }) : 'sem data'}
                      </span>
                      <small>
                        {d
                          ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                          : ''}
                      </small>
                    </div>
                    <span className="tv-agenda-type">
                      <Icone nome={r.tipo === 'visita' ? 'local' : 'relogio'} />
                    </span>
                    <div className="tv-agenda-info">
                      <div className="tv-agenda-title">
                        <button onClick={() => setVisualizar(r)}>{nomeRegistro(r)}</button>
                        <Selo valor={r.status}>{rotulo(r.status)}</Selo>
                      </div>
                      <p>
                        {nomeConta(r.contaId)} <span>·</span> {rotulo(r.tipo)} <span>·</span>{' '}
                        {rotulo(r.canal)}
                      </p>
                      {r.local ? <small>{r.local}</small> : null}
                      <small className="tv-assigned-person">
                        Responsável: {descricaoUsuario(equipe.equipe, r.responsavelId)}
                      </small>
                      {r.colaboradoresIds?.length ? (
                        <small className="tv-assigned-person">
                          Colaboradores:{' '}
                          {r.colaboradoresIds
                            .map((id) => descricaoUsuario(equipe.equipe, id))
                            .join('; ')}
                        </small>
                      ) : null}
                      {r.realizacao ? <p>Realização: {r.realizacao}</p> : null}
                      {r.realizadoEm ? (
                        <small>
                          Realizada em {dataFormatada(r.realizadoEm, true)} ·{' '}
                          {descricaoUsuario(equipe.equipe, r.realizadoPor)}
                        </small>
                      ) : null}
                      {r.resultado ? (
                        <p className="tv-activity-outcome">Resultado: {r.resultado}</p>
                      ) : null}
                      {r.proximaAcao ? (
                        <p className="tv-next-action">Próximo passo: {r.proximaAcao}</p>
                      ) : null}
                    </div>
                    <div className="tv-agenda-actions">
                      {escrita && r.status === 'planejada' && !r.arquivado ? (
                        <button
                          className="tv-button tv-button-light"
                          onClick={() => setEditor({ ...r, status: 'concluida' })}
                        >
                          <Icone nome="check" tamanho={17} />
                          Registrar resultado
                        </button>
                      ) : null}
                      {acoes(r)}
                    </div>
                  </article>
                );
              })}
          </div>
        ) : null}
        {pronto && registros.length && ['contas', 'produtos', 'propostas'].includes(secao) ? (
          <div className="tv-table-scroll">
            <table className="tv-table">
              <thead>
                <tr>
                  <th>
                    {secao === 'contas'
                      ? 'Conta / instituição'
                      : secao === 'produtos'
                        ? 'Produto / linha'
                        : 'Proposta'}
                  </th>
                  <th>
                    {secao === 'contas'
                      ? 'Segmento'
                      : secao === 'produtos'
                        ? 'Fabricante'
                        : 'Conta'}
                  </th>
                  <th>
                    {secao === 'contas'
                      ? 'Território'
                      : secao === 'produtos'
                        ? 'Categoria'
                        : 'Situação'}
                  </th>
                  <th>
                    {secao === 'contas'
                      ? 'Próxima visita'
                      : secao === 'produtos'
                        ? 'Preço de referência'
                        : 'Total confirmado'}
                  </th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {registros.map((r) => (
                  <tr key={r._id}>
                    <td>
                      <div className="tv-name-cell">
                        <span className="tv-account-monogram">
                          {secao === 'contas' ? (
                            nomeRegistro(r).slice(0, 2).toUpperCase()
                          ) : (
                            <Icone nome={config.icone} />
                          )}
                        </span>
                        <div>
                          {secao === 'contas' ? (
                            <Link to={`/carteira/${r._id}`} className="tv-record-name">
                              {nomeRegistro(r)}
                            </Link>
                          ) : (
                            <button className="tv-record-name" onClick={() => setVisualizar(r)}>
                              {nomeRegistro(r)}
                            </button>
                          )}
                          <small>
                            {secao === 'contas'
                              ? [
                                  r.contatoNome,
                                  r.cidade && `${r.cidade}${r.uf ? ` / ${r.uf}` : ''}`,
                                ]
                                  .filter(Boolean)
                                  .join(' · ') || 'Detalhes ainda não informados'
                              : secao === 'produtos'
                                ? [r.codigo, r.linha].filter(Boolean).join(' · ') ||
                                  'Sem linha definida'
                                : `Validade: ${dataFormatada(r.validade)}`}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>
                      {secao === 'contas' ? (
                        <>
                          <Selo valor={r.trilha}>{rotulo(r.trilha ?? 'funil')}</Selo>
                          <small className="tv-cell-subtext">
                            {(r.trilha ?? 'funil') === 'adormecido'
                              ? `Retomar em ${dataFormatada(r.retomarEm, true)}`
                              : (r.trilha ?? 'funil') === 'funil'
                                ? rotulo(r.etapaJornada ?? 'conversa')
                                : r.proximaAcao || 'Defina a próxima ação'}
                          </small>
                        </>
                      ) : secao === 'produtos' ? (
                        r.fabricante || 'Não informado'
                      ) : (
                        nomeConta(r.contaId)
                      )}
                    </td>
                    <td>
                      {secao === 'contas' ? (
                        <>
                          <span>{r.territorio || 'Não informado'}</span>
                          <small className="tv-cell-subtext">
                            <Selo valor={r.classificacao}>Classe {r.classificacao ?? 'B'}</Selo>
                          </small>
                        </>
                      ) : secao === 'produtos' ? (
                        <Selo valor={r.categoria}>{rotulo(r.categoria)}</Selo>
                      ) : (
                        <Selo valor={r.status}>{rotulo(r.status)}</Selo>
                      )}
                    </td>
                    <td>
                      {secao === 'contas' ? (
                        dataFormatada(r.proximaVisita, true)
                      ) : (
                        <strong>
                          {moeda(secao === 'produtos' ? r.precoCentavos : r.totalCentavos)}
                        </strong>
                      )}
                    </td>
                    <td>{acoes(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {pronto ? (
          <div className="tv-pagination">
            <span>
              {lista.dados?.total ?? 0} {(lista.dados?.total ?? 0) === 1 ? 'registro' : 'registros'}{' '}
              <span>·</span> Página {pagina} de{' '}
              {Math.max(1, Math.ceil((lista.dados?.total ?? 0) / 30))}
            </span>
            <div>
              <button
                className="tv-small-button"
                disabled={pagina <= 1}
                onClick={() => {
                  const p = new URLSearchParams(params);
                  p.set('pagina', String(pagina - 1));
                  setParams(p);
                }}
              >
                Anterior
              </button>
              <button
                className="tv-small-button"
                disabled={pagina * 30 >= (lista.dados?.total ?? 0)}
                onClick={() => {
                  const p = new URLSearchParams(params);
                  p.set('pagina', String(pagina + 1));
                  setParams(p);
                }}
              >
                Próxima
              </button>
            </div>
          </div>
        ) : null}
      </section>
      {secao === 'produtos' && !escrita ? (
        <p className="tv-help-text">
          O catálogo é compartilhado. A gestão mantém os produtos e preços de referência.
        </p>
      ) : null}
      {editor !== null && escrita ? (
        <EditorRegistro
          key={editor === 'novo' ? 'novo' : editor._id}
          secao={secao}
          registro={editor === 'novo' ? null : editor}
          inicial={
            editor === 'novo' && params.get('contaId')
              ? { contaId: params.get('contaId') ?? '' }
              : undefined
          }
          aoFechar={() => setEditor(null)}
          aoSalvar={() => {
            setEditor(null);
            setMensagem('Alteração confirmada no servidor.');
            lista.atualizar();
          }}
        />
      ) : null}
      {confirmando ? (
        <Modal
          titulo={`${confirmando.arquivado ? 'Restaurar' : 'Arquivar'} ${config.singular}`}
          aoFechar={() => setConfirmando(null)}
          bloqueado={Boolean(ocupado)}
        >
          <div className="tv-modal-body">
            <h3>{nomeRegistro(confirmando)}</h3>
            <p>
              {confirmando.arquivado
                ? 'O registro voltará à lista ativa da carteira.'
                : 'O registro sairá da lista ativa e ficará disponível em Arquivados para consulta e restauração.'}
            </p>
          </div>
          <div className="tv-modal-footer">
            <button
              className="tv-button tv-button-light"
              disabled={Boolean(ocupado)}
              onClick={() => setConfirmando(null)}
            >
              Cancelar
            </button>
            <button
              className="tv-button tv-button-primary"
              disabled={Boolean(ocupado)}
              onClick={() => void arquivar()}
            >
              {ocupado
                ? 'Confirmando…'
                : confirmando.arquivado
                  ? 'Restaurar registro'
                  : 'Arquivar registro'}
            </button>
          </div>
        </Modal>
      ) : null}
      {visualizar ? (
        <Modal
          titulo={nomeRegistro(visualizar)}
          aoFechar={() => setVisualizar(null)}
          largo={secao === 'propostas'}
          bloqueado={rascunhoOcupado}
        >
          <div className="tv-modal-body">
            {mensagemRascunho ? (
              <p className="tv-success" role="status">
                {mensagemRascunho}
              </p>
            ) : null}
            {erroRascunho ? (
              <div className="tv-inline-error" role="alert">
                <p>{erroRascunho}</p>
                <button
                  className="tv-small-button"
                  disabled={rascunhoOcupado}
                  onClick={() => void atualizarPropostaAberta()}
                >
                  Consultar versão atual da proposta
                </button>
              </div>
            ) : null}
            {secao === 'propostas' ? (
              <ConteudoProposta
                registro={visualizar}
                conta={contas.find((c) => c._id === visualizar.contaId)}
              />
            ) : (
              <ResumoRegistro registro={visualizar} nomeConta={nomeConta} equipe={equipe.equipe} />
            )}
          </div>
          <div className="tv-modal-footer">
            {secao === 'propostas' ? (
              <>
                {escrita ? (
                  <button
                    className="tv-button tv-button-primary"
                    disabled={rascunhoOcupado}
                    onClick={() => void solicitarRascunho()}
                  >
                    {rascunhoOcupado ? 'Confirmando solicitação…' : 'Abrir rascunho de e-mail'}
                  </button>
                ) : null}
                <button
                  className="tv-button tv-button-light"
                  disabled={rascunhoOcupado}
                  onClick={() => imprimir(visualizar)}
                >
                  Imprimir proposta
                </button>
              </>
            ) : null}
            {escrita ? (
              <button
                className="tv-button tv-button-primary"
                disabled={rascunhoOcupado}
                onClick={() => {
                  setEditor(visualizar);
                  setVisualizar(null);
                }}
              >
                Editar registro
              </button>
            ) : null}
            <button
              className="tv-button tv-button-light"
              disabled={rascunhoOcupado}
              onClick={() => setVisualizar(null)}
            >
              Fechar
            </button>
          </div>
        </Modal>
      ) : null}
      {impressao
        ? createPortal(
            <div className="tv-print-sheet">
              <ConteudoProposta
                registro={impressao}
                conta={contas.find((c) => c._id === impressao.contaId)}
              />
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
function ResumoRegistro({
  registro: r,
  nomeConta,
  equipe,
}: {
  registro: Registro;
  nomeConta: (id?: string) => string;
  equipe: UsuarioComercial[];
}) {
  const campos = [
    ['Conta', r.contaId ? nomeConta(r.contaId) : ''],
    ['Situação', r.status ? rotulo(r.status) : ''],
    ['Etapa', r.etapa ? rotulo(r.etapa) : ''],
    ['Tipo', r.tipo ? rotulo(r.tipo) : ''],
    ['Canal', r.canal ? rotulo(r.canal) : ''],
    ['Data', r.data ? dataFormatada(r.data, true) : ''],
    ['Valor', r.valorCentavos != null ? moeda(r.valorCentavos) : ''],
    ['Probabilidade', r.probabilidade != null ? `${r.probabilidade}%` : ''],
    ['Previsão', r.previsao ? dataFormatada(r.previsao) : ''],
    ['Fabricante', r.fabricante],
    ['Linha', r.linha],
    ['Categoria', r.categoria ? rotulo(r.categoria) : ''],
    ['Preço de referência', r.precoCentavos != null ? moeda(r.precoCentavos) : ''],
    ['Unidade', r.unidade],
    ['Código', r.codigo],
    ['Descrição', r.descricao],
    ['Local', r.local],
    ['Responsável', r.secao === 'atividades' ? descricaoUsuario(equipe, r.responsavelId) : ''],
    ['Colaboradores', r.colaboradoresIds?.map((id) => descricaoUsuario(equipe, id)).join('; ')],
    ['Resultado', r.resultado],
    ['Realização', r.realizacao],
    ['Realizada em', r.realizadoEm ? dataFormatada(r.realizadoEm, true) : ''],
    ['Realizada por', r.realizadoPor ? descricaoUsuario(equipe, r.realizadoPor) : ''],
    ['Próxima ação', r.proximaAcao],
    ['Observações', r.observacoes],
    ['Atualização', dataFormatada(r.alteradoEm, true)],
  ];
  return (
    <dl className="tv-detail-grid">
      {campos
        .filter(([, v]) => v)
        .map(([chave, valor]) => (
          <div key={chave}>
            <dt>{chave}</dt>
            <dd>{valor}</dd>
          </div>
        ))}
    </dl>
  );
}
export function ConteudoProposta({ registro: r, conta }: { registro: Registro; conta?: Registro }) {
  return (
    <article className="tv-quote-document">
      <img
        className="tv-quote-brand"
        src={`${import.meta.env.BASE_URL}brand/telaviva-lockup.svg`}
        alt="Tela Viva — cuidados para pele tatuada"
      />
      <div className="tv-quote-document-heading">
        <div>
          <span className="tv-eyebrow">TELA VIVA</span>
          <h2>Proposta comercial</h2>
          <p>{nomeRegistro(r)}</p>
        </div>
        <Selo valor={r.status}>{rotulo(r.status)}</Selo>
      </div>
      <dl className="tv-detail-grid">
        <div>
          <dt>Destinatário</dt>
          <dd>{conta ? nomeRegistro(conta) : 'Destinatário não informado'}</dd>
        </div>
        <div>
          <dt>Validade</dt>
          <dd>{dataFormatada(r.validade)}</dd>
        </div>
        <div>
          <dt>Emissão</dt>
          <dd>{dataFormatada(r.criadoEm)}</dd>
        </div>
        <div>
          <dt>Contato</dt>
          <dd>{contatoDaProposta(r, conta)?.nome || 'Não informado'}</dd>
        </div>
        <div>
          <dt>E-mail do destinatário</dt>
          <dd>
            {contatoDaProposta(r, conta)?.email ||
              'Selecione um contato ativo com e-mail para preparar o rascunho.'}
          </dd>
        </div>
      </dl>
      <div className="tv-table-scroll">
        <table className="tv-table">
          <thead>
            <tr>
              <th>Descrição</th>
              <th>Qtd.</th>
              <th>Unitário</th>
              <th>Desc.</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {(r.itens ?? []).map((i, n) => (
              <tr key={n}>
                <td>{i.descricao || 'Item sem descrição'}</td>
                <td>{i.quantidade}</td>
                <td>{moeda(i.precoUnitarioCentavos)}</td>
                <td>{i.descontoPercentual}%</td>
                <td>
                  {moeda(
                    i.quantidade * i.precoUnitarioCentavos -
                      Math.round(
                        (i.quantidade * i.precoUnitarioCentavos * i.descontoPercentual) / 100,
                      ),
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="tv-quote-totals">
        <span>
          Subtotal<strong>{moeda(r.subtotalCentavos)}</strong>
        </span>
        <span>
          Descontos<strong>{moeda(r.descontoCentavos)}</strong>
        </span>
        <span className="tv-total">
          Total confirmado<strong>{moeda(r.totalCentavos)}</strong>
        </span>
      </div>
      {r.condicoesPagamento ? (
        <div className="tv-quote-note">
          <strong>Condições comerciais</strong>
          <p>{r.condicoesPagamento}</p>
        </div>
      ) : null}
      {r.observacoes ? (
        <div className="tv-quote-note">
          <strong>Observações</strong>
          <p>{r.observacoes}</p>
        </div>
      ) : null}
      <footer className="tv-quote-issuer">
        <strong>JSETTE7 Comércio de Produtos Médicos e Hospitalares LTDA</strong>
        <br />
        CNPJ 54.765.439/0001-34
        <br />
        Av. Paulo Afonso, 615 · Nova Petrópolis · São Bernardo do Campo/SP · CEP 09770-351
        <br />
        settedistribuidora0777@gmail.com · +55 (11) 91497-7007
      </footer>
      <p className="tv-help-text">
        A impressão e a abertura do rascunho de e-mail não enviam esta proposta. Confira o
        destinatário e confirme o envio no seu aplicativo de e-mail.
      </p>
    </article>
  );
}
