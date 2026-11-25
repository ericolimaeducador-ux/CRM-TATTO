import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { cabecalhosDaSessao, perfilLogado, podeGerir } from '@/lib/offline/sessao';
import { urlDaApi } from '@/lib/api-url';
import { CabecalhoPagina, Icone, Selo } from './componentes';
import { Modal } from './EditorRegistro';
import {
  apiCampanhas,
  CADENCIA_INICIAL,
  ErroCampanha,
  ESTADOS_CAMPANHA,
  linkWhatsApp,
  MENSAGEM_CAMPANHA,
  motivoCampanha,
  type Campanha,
  type ModoEnvio,
  type CandidatoCampanha,
  type ConfigCampanhas,
  type EventoCampanha,
  type ListaCampanhas,
  type PreviaCampanha,
  type ResultadoCampanha,
  type TemplateCampanha,
} from './campanhas-api';
import { PendenciasDeCampanha } from './PendenciasCampanha';
import './campanhas.css';

const dataHora = (valor?: string | null) =>
  valor
    ? new Date(valor).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    : 'Ainda não registrado';
const novaCampanha = (modo: ModoEnvio = 'manual'): Campanha => ({
  _id: '',
  titulo: 'Pós Tattoo Week',
  mensagem: MENSAGEM_CAMPANHA,
  contatosIds: [],
  template: null,
  cadencia: { ...CADENCIA_INICIAL },
  modo,
  estado: 'rascunho',
  versao: 0,
  criadoEm: '',
  alteradoEm: '',
});
const normalizar = (valor: string) => valor.replace(/\r\n/g, '\n').trim();
const CONFIG_ROTULOS: Record<string, string> = {
  WHATSAPP_API_VERSAO: 'Conexão com a plataforma WhatsApp',
  WHATSAPP_PHONE_NUMBER_ID: 'Número empresarial para envio',
  WHATSAPP_WABA_ID: 'Conta empresarial para consultar modelos',
  WHATSAPP_ACCESS_TOKEN: 'Autorização de acesso à conta',
  WHATSAPP_APP_SECRET: 'Verificação segura de recibos',
  WHATSAPP_VERIFY_TOKEN: 'Conexão de recibos e respostas',
};

export function PaginaCampanhas() {
  const [, atualizarPerfil] = useState(0);
  useEffect(() => {
    const atualizar = () => atualizarPerfil((n) => n + 1);
    window.addEventListener('tela-viva-sessao', atualizar);
    window.addEventListener('storage', atualizar);
    return () => {
      window.removeEventListener('tela-viva-sessao', atualizar);
      window.removeEventListener('storage', atualizar);
    };
  }, []);
  if (!podeGerir())
    return (
      <div className="tv-page">
        <CabecalhoPagina
          titulo="Campanhas"
          descricao="WhatsApp para contatos selecionados, com revisão e acompanhamento."
        />
        <section className="tv-panel tv-campaign-section">
          <h2>Acesso da gestão</h2>
          <p>
            Entre com um perfil de gestor ou administrador para preparar e acompanhar campanhas.
          </p>
          <Link className="tv-button tv-button-primary" to="/entrar">
            Entrar no Tela Viva
          </Link>
        </section>
      </div>
    );
  return <CampanhasGestao key={perfilLogado()?.id ?? 'gestao'} />;
}

function CampanhasGestao() {
  const { id } = useParams();
  const navegar = useNavigate();
  const [config, setConfig] = useState<ConfigCampanhas | null>(null);
  const [lista, setLista] = useState<ListaCampanhas<Campanha> | null>(null);
  const [paginaLista, setPaginaLista] = useState(1);
  const [novo, setNovo] = useState(false);
  const [form, setForm] = useState<Campanha>(novaCampanha);
  const [salva, setSalva] = useState<Campanha | null>(null);
  const [dirty, setDirty] = useState(false);
  const [ocupado, setOcupado] = useState('');
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [conflito, setConflito] = useState(false);
  const [comparacao, setComparacao] = useState<Campanha | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [candidatos, setCandidatos] = useState<ListaCampanhas<CandidatoCampanha> | null>(null);
  const [filtros, setFiltros] = useState({ q: '', origem: '', tag: '', de: '', ate: '' });
  const [consulta, setConsulta] = useState('');
  const [paginaCandidatos, setPaginaCandidatos] = useState(1);
  const [erroCandidatos, setErroCandidatos] = useState('');
  const [modelos, setModelos] = useState<TemplateCampanha[]>([]);
  const [modelosConsultados, setModelosConsultados] = useState(false);
  const [previa, setPrevia] = useState<PreviaCampanha | null>(null);
  const [resultados, setResultados] = useState<ResultadoCampanha | null>(null);
  const [paginaResultados, setPaginaResultados] = useState(1);
  const [eventos, setEventos] = useState<EventoCampanha[]>([]);
  const [confirmacao, setConfirmacao] = useState<'iniciar' | 'retomar' | 'cancelar' | null>(null);
  const [conferiu, setConferiu] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [agora, setAgora] = useState(() => Date.now());
  const [linkManual, setLinkManual] = useState<{ nome: string; url: string } | null>(null);
  const [linksAtualizacao, setLinksAtualizacao] = useState<Record<string, string>>({});
  const editor = Boolean(id || novo);
  const manual = (form.modo ?? 'api') === 'manual';
  const ultimaManual = resultados?.ultimaAberturaManualEm
    ? Date.parse(resultados.ultimaAberturaManualEm)
    : 0;
  const esperaManual =
    manual && ultimaManual
      ? Math.max(
          0,
          Math.ceil((ultimaManual + form.cadencia.intervaloSegundos * 1000 - agora) / 1000),
        )
      : 0;
  const editavel = form.estado === 'rascunho';
  const bloqueado = Boolean(ocupado || carregando);
  const prontoAcoes = Boolean(salva && !dirty && !conflito && !bloqueado);

  const aplicar = useCallback((campanha: Campanha) => {
    setForm(campanha);
    setSalva(campanha);
    setDirty(false);
    setConflito(false);
    setComparacao(null);
    setPrevia(null);
  }, []);
  useEffect(() => {
    let vivo = true;
    void apiCampanhas<{ registro: ConfigCampanhas }>('/configuracao')
      .then((r) => {
        if (vivo) setConfig(r.registro);
      })
      .catch((e: Error) => {
        if (vivo) setErro(e.message);
      });
    return () => {
      vivo = false;
    };
  }, []);
  useEffect(() => {
    let vivo = true;
    if (id || novo) return;
    setCarregando(true);
    void apiCampanhas<ListaCampanhas<Campanha>>(`?pagina=${paginaLista}`)
      .then((r) => {
        if (vivo) setLista(r);
      })
      .catch((e: Error) => {
        if (vivo) setErro(e.message);
      })
      .finally(() => {
        if (vivo) setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, [id, novo, paginaLista]);
  useEffect(() => {
    let vivo = true;
    setErro('');
    setMensagem('');
    setResultados(null);
    setEventos([]);
    setPaginaResultados(1);
    if (!id) return;
    setSalva(null);
    setForm(novaCampanha());
    setDirty(false);
    setConflito(false);
    setNovo(false);
    setCarregando(true);
    void apiCampanhas<{ registro: Campanha }>(`/${id}`)
      .then((r) => {
        if (vivo) aplicar(r.registro);
      })
      .catch((e: Error) => {
        if (vivo) setErro(e.message);
      })
      .finally(() => {
        if (vivo) setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, [id, aplicar]);
  useEffect(() => {
    if (!editor) return;
    let vivo = true;
    setCandidatos(null);
    setErroCandidatos('');
    void apiCampanhas<ListaCampanhas<CandidatoCampanha>>(
      `/candidatos?pagina=${paginaCandidatos}${consulta ? `&${consulta}` : ''}`,
    )
      .then((r) => {
        if (vivo) setCandidatos(r);
      })
      .catch((e: Error) => {
        if (vivo) setErroCandidatos(e.message);
      });
    return () => {
      vivo = false;
    };
  }, [editor, consulta, paginaCandidatos]);
  useEffect(() => {
    if (!id || !salva || salva._id !== id) return;
    let vivo = true;
    void apiCampanhas<{ registro: ResultadoCampanha }>(
      `/${id}/resultados?pagina=${paginaResultados}`,
    )
      .then((r) => {
        if (vivo) setResultados(r.registro);
      })
      .catch((e: Error) => {
        if (vivo) setErro(e.message);
      });
    void apiCampanhas<{ registro: { eventos: EventoCampanha[] } }>(`/${id}/auditoria`)
      .then((r) => {
        if (vivo) setEventos(r.registro.eventos);
      })
      .catch((e: Error) => {
        if (vivo) setErro(e.message);
      });
    return () => {
      vivo = false;
    };
  }, [id, salva, paginaResultados, recarga]);
  // Relógio do intervalo entre contatos no envio manual.
  useEffect(() => {
    if (!manual || form.estado !== 'preparada') return;
    const t = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [manual, form.estado]);
  useEffect(() => {
    if (!dirty) return;
    const aoSair = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    const aoNavegar = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!link || link.target === '_blank') return;
      const url = new URL(link.href, window.location.href);
      if (url.pathname === window.location.pathname && url.search === window.location.search)
        return;
      if (
        !window.confirm('Existem alterações sem salvar nesta campanha. Deseja sair e descartá-las?')
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', aoSair);
    document.addEventListener('click', aoNavegar, true);
    return () => {
      window.removeEventListener('beforeunload', aoSair);
      document.removeEventListener('click', aoNavegar, true);
    };
  }, [dirty]);

  function alterar(patch: Partial<Campanha>) {
    setForm((atual) => ({ ...atual, ...patch }));
    setDirty(true);
    setPrevia(null);
  }
  function tratarErro(e: unknown) {
    setErro(e instanceof Error ? e.message : 'Não foi possível confirmar esta operação.');
    if (e instanceof ErroCampanha && e.status === 409) setConflito(true);
  }
  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (bloqueado || conflito) return;
    setOcupado('salvar');
    setErro('');
    setMensagem('');
    try {
      const corpo = {
        titulo: form.titulo,
        mensagem: form.mensagem,
        contatosIds: form.contatosIds,
        template: form.template,
        cadencia: form.cadencia,
        modo: form.modo ?? 'api',
        ...(salva ? { versao: salva.versao } : {}),
      };
      const r = await apiCampanhas<{ registro: Campanha }>(
        salva ? `/${salva._id}` : '',
        salva ? 'PATCH' : 'POST',
        corpo,
      );
      aplicar(r.registro);
      setMensagem('Rascunho salvo no servidor. Nenhum envio foi iniciado.');
      if (!salva) {
        setNovo(false);
        navegar(`/campanhas/${r.registro._id}`);
      }
    } catch (e) {
      tratarErro(e);
    } finally {
      setOcupado('');
    }
  }
  async function atualizar() {
    if (!salva || bloqueado) return;
    setOcupado('atualizar');
    setErro('');
    try {
      const r = await apiCampanhas<{ registro: Campanha }>(`/${salva._id}`);
      if (dirty || conflito) setComparacao(r.registro);
      else aplicar(r.registro);
    } catch (e) {
      tratarErro(e);
    } finally {
      setOcupado('');
    }
  }
  async function consultarPrevia() {
    if (!prontoAcoes || !salva) return;
    setOcupado('previa');
    setErro('');
    try {
      const r = await apiCampanhas<{ registro: PreviaCampanha }>(`/${salva._id}/previa`, 'POST', {
        versao: salva.versao,
      });
      setPrevia(r.registro);
    } catch (e) {
      tratarErro(e);
    } finally {
      setOcupado('');
    }
  }
  async function consultarModelos() {
    setOcupado('modelos');
    setErro('');
    try {
      const r = await apiCampanhas<{ registros: TemplateCampanha[] }>('/templates');
      setModelos(r.registros);
      setModelosConsultados(true);
    } catch (e) {
      tratarErro(e);
    } finally {
      setOcupado('');
    }
  }
  async function reverConfiguracao() {
    setOcupado('configuracao');
    setErro('');
    try {
      const r = await apiCampanhas<{ registro: ConfigCampanhas }>('/configuracao');
      setConfig(r.registro);
    } catch (e) {
      tratarErro(e);
    } finally {
      setOcupado('');
    }
  }
  async function acao(tipo: 'preparar' | 'pausar' | 'iniciar' | 'retomar' | 'cancelar') {
    if (!prontoAcoes || !salva) return;
    setOcupado(tipo);
    setErro('');
    setMensagem('');
    try {
      const r = await apiCampanhas<{ registro: Campanha; aviso?: string }>(
        `/${salva._id}/${tipo}`,
        'POST',
        {
          versao: salva.versao,
          ...(['iniciar', 'retomar'].includes(tipo) ? { confirmar: true } : {}),
        },
      );
      aplicar(r.registro);
      setConfirmacao(null);
      setConferiu(false);
      setMensagem(
        tipo === 'preparar'
          ? 'Público preparado e salvo. Nenhum envio foi iniciado.'
          : r.aviso || 'Operação confirmada no servidor.',
      );
    } catch (e) {
      tratarErro(e);
    } finally {
      setOcupado('');
    }
  }
  async function abrirConfirmacao(tipo: 'iniciar' | 'retomar' | 'cancelar') {
    if (!prontoAcoes || !salva) return;
    if (tipo !== 'cancelar') {
      setOcupado('conferir');
      setErro('');
      try {
        const r = await apiCampanhas<{ registro: PreviaCampanha }>(`/${salva._id}/previa`, 'POST', {
          versao: salva.versao,
        });
        setPrevia(r.registro);
      } catch (e) {
        tratarErro(e);
        return;
      } finally {
        setOcupado('');
      }
    }
    setConferiu(false);
    setConfirmacao(tipo);
  }
  /**
   * Abre a conversa no WhatsApp com o texto pronto. A aba é aberta já no clique
   * (senão o navegador bloqueia) e recebe o endereço depois que o servidor confere
   * a autorização do contato. Nada é enviado sem o clique da pessoa no WhatsApp.
   */
  async function enviarManual(destinatarioId: string, nome: string) {
    if (!salva || bloqueado) return;
    const celular = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
    const aba = celular ? null : window.open('', 'tela-viva-whatsapp');
    // A aba do WhatsApp não precisa de acesso a esta página.
    if (aba) aba.opener = null;
    setOcupado(`manual:${destinatarioId}`);
    setErro('');
    setMensagem('');
    setLinkManual(null);
    try {
      const r = await apiCampanhas<{ registro: { telefone: string; texto: string } }>(
        `/${salva._id}/destinatarios/${destinatarioId}/whatsapp-manual`,
        'POST',
        {},
      );
      const url = linkWhatsApp(r.registro.telefone, r.registro.texto, celular);
      if (aba && !aba.closed) {
        aba.location.href = url;
        aba.focus();
      } else if (celular) {
        window.location.href = url;
      } else {
        setLinkManual({ nome, url });
      }
      setMensagem(
        `Conversa com ${nome} aberta no WhatsApp. Confira o texto e clique em enviar por lá.`,
      );
    } catch (e) {
      aba?.close();
      // Aqui 409 é contato inelegível e 429 é o intervalo; não é conflito de versão.
      setErro(e instanceof Error ? e.message : 'Não foi possível abrir a conversa.');
    } finally {
      setOcupado('');
      setRecarga((n) => n + 1);
    }
  }

  async function gerarLinkAtualizacao(contatoId: string, nome: string) {
    setOcupado(`atualizacao:${contatoId}`);
    setErro('');
    try {
      const resposta = await fetch(urlDaApi(`/v1/contatos/${contatoId}/link-atualizacao`), {
        method: 'POST',
        headers: cabecalhosDaSessao(),
      });
      const json = (await resposta.json().catch(() => null)) as {
        caminho?: string;
        mensagem?: string;
      } | null;
      if (!resposta.ok || !json?.caminho)
        throw new Error(json?.mensagem ?? 'Não foi possível gerar o link.');
      const base = import.meta.env.BASE_URL.replace(/\/$/, '');
      const link = `${window.location.origin}${base}${json.caminho}`;
      setLinksAtualizacao((antes) => ({ ...antes, [contatoId]: link }));
      await navigator.clipboard?.writeText(link).catch(() => undefined);
      setMensagem(`Link de atualização de ${nome} copiado. Envie-o somente para esta pessoa.`);
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Não foi possível gerar o link.');
    } finally {
      setOcupado('');
    }
  }
  function buscar(e: FormEvent) {
    e.preventDefault();
    setPaginaCandidatos(1);
    setConsulta(new URLSearchParams(Object.entries(filtros).filter(([, v]) => v)).toString());
  }
  function escolher(c: CandidatoCampanha, marcado: boolean) {
    if ((!c.elegivel && marcado) || !editavel) return;
    alterar({
      contatosIds: marcado
        ? [...new Set([...form.contatosIds, c.id])]
        : form.contatosIds.filter((id) => id !== c.id),
    });
  }
  function selecionarPagina() {
    if (!candidatos || !editavel || bloqueado) return;
    const ids = [
      ...new Set([
        ...form.contatosIds,
        ...candidatos.registros.filter((c) => c.elegivel).map((c) => c.id),
      ]),
    ].slice(0, config?.limitePublico ?? 2000);
    if (ids.length !== form.contatosIds.length) alterar({ contatosIds: ids });
  }
  const consultaModelosDisponivel = Boolean(
    config &&
    !config.faltantes.some((c) =>
      ['WHATSAPP_API_VERSAO', 'WHATSAPP_WABA_ID', 'WHATSAPP_ACCESS_TOKEN'].includes(c),
    ),
  );
  const mensagemCompativel = Boolean(
    form.template && normalizar(form.template.corpo) === normalizar(form.mensagem),
  );

  return (
    <div className="tv-page tv-campaigns">
      <CabecalhoPagina
        titulo="Campanhas"
        descricao="Revise o público, prepare o WhatsApp e acompanhe cada resultado."
        acao={
          !editor ? (
            <button
              className="tv-button tv-button-primary"
              onClick={() => {
                setNovo(true);
                setForm(novaCampanha());
                setSalva(null);
                setDirty(false);
                setErro('');
              }}
            >
              <Icone nome="mais" />
              Nova campanha
            </button>
          ) : undefined
        }
      />
      {config ? (
        <section className="tv-panel tv-campaign-section" aria-label="Preparação do WhatsApp">
          <h2>
            {config.envioAtivo ? 'Envio habilitado no ambiente' : 'Envio desativado no ambiente'}
          </h2>
          <p>
            Você pode salvar e revisar rascunhos agora. Preparar o público não inicia mensagens;
            iniciar exige configuração, modelo aprovado e confirmação.
          </p>
          <button
            className="tv-small-button"
            disabled={bloqueado}
            onClick={() => void reverConfiguracao()}
          >
            Rever configuração
          </button>
          {config.faltantes.length ? (
            <>
              <p>
                <strong>Antes de enviar, o responsável precisa concluir:</strong>
              </p>
              <ul className="tv-campaign-checklist">
                {config.faltantes.map((c) => (
                  <li key={c}>{CONFIG_ROTULOS[c] ?? 'Configuração da conta empresarial'}</li>
                ))}
              </ul>
            </>
          ) : (
            <p>
              Configuração disponível. A situação do modelo e a autorização de cada contato serão
              verificadas antes da saída.
            </p>
          )}
          <details>
            <summary>Instruções de configuração para a administração</summary>
            <p>
              O responsável configura a conta e o número empresarial no servidor, com recibos e
              respostas por HTTPS. Não cole tokens ou senhas nesta tela.
            </p>
            <p>
              O envio de campanhas é controlado por <code>CAMPANHAS_WHATSAPP_ATIVO</code>, separado
              das boas-vindas. Configurações pendentes:{' '}
              {config.faltantes.length ? config.faltantes.join(', ') : 'nenhuma identificada'}.
            </p>
          </details>
        </section>
      ) : (
        <button
          className="tv-button tv-button-light"
          disabled={bloqueado}
          onClick={() => void reverConfiguracao()}
        >
          Rever configuração
        </button>
      )}
      {erro ? (
        <div className="tv-inline-error" role="alert">
          <strong>A operação não foi confirmada.</strong>
          <p>{erro}</p>
          {conflito ? (
            <p>
              Seus campos foram preservados. Consulte a versão atual e compare antes de continuar.
            </p>
          ) : null}
        </div>
      ) : null}
      {mensagem ? (
        <p className="tv-success" role="status">
          {mensagem}
        </p>
      ) : null}
      {carregando ? <p role="status">Carregando campanhas…</p> : null}
      {!editor ? (
        <section className="tv-panel tv-campaign-section">
          <h2>Campanhas salvas</h2>
          {lista?.registros.length === 0 ? (
            <p>
              Nenhuma campanha criada. Comece com um rascunho; a seleção do público será feita por
              você.
            </p>
          ) : null}
          <div className="tv-campaign-list">
            {lista?.registros.map((c) => (
              <Link className="tv-campaign-card" key={c._id} to={`/campanhas/${c._id}`}>
                <strong>{c.titulo || 'Campanha sem título'}</strong>
                <Selo valor={c.estado}>{ESTADOS_CAMPANHA[c.estado]}</Selo>
                <span>
                  {c.contatosIds.length} contatos selecionados · Versão {c.versao}
                </span>
                <small>Atualizada em {dataHora(c.alteradoEm)}</small>
              </Link>
            ))}
          </div>
          {lista ? (
            <Paginacao
              pagina={paginaLista}
              total={lista.total}
              limite={lista.limite}
              alterar={setPaginaLista}
              nome="campanhas"
            />
          ) : null}
        </section>
      ) : null}
      {!editor ? <PendenciasDeCampanha /> : null}
      {!editor ? null : id && salva?._id !== id ? null : (
        <>
          <div className="tv-campaign-actions">
            <Link
              to="/campanhas"
              onClick={() => {
                if (!dirty) setNovo(false);
              }}
            >
              Voltar às campanhas
            </Link>
            {salva ? (
              <button
                className="tv-button tv-button-light"
                disabled={bloqueado}
                onClick={() => void atualizar()}
              >
                {dirty || conflito ? 'Comparar versão atual' : 'Atualizar campanha'}
              </button>
            ) : (
              <button
                className="tv-small-button"
                onClick={() => {
                  if (!dirty || window.confirm('Descartar este rascunho ainda não salvo?')) {
                    setNovo(false);
                    setDirty(false);
                  }
                }}
              >
                Fechar rascunho
              </button>
            )}
          </div>
          {comparacao ? (
            <section className="tv-panel tv-campaign-section">
              <h2>Versão atual no servidor: {comparacao.versao}</h2>
              <p>
                {comparacao.titulo} · {ESTADOS_CAMPANHA[comparacao.estado]} ·{' '}
                {comparacao.contatosIds.length} contatos
              </p>
              <pre className="tv-campaign-message">{comparacao.mensagem}</pre>
              <p>
                Seus campos continuam no formulário abaixo. Copie o que precisa manter antes de
                carregar os dados do servidor.
              </p>
              <button
                className="tv-button tv-button-light"
                onClick={() => {
                  if (
                    window.confirm('Carregar a versão atual e substituir seus campos sem salvar?')
                  )
                    aplicar(comparacao);
                }}
              >
                Carregar versão atual
              </button>
            </section>
          ) : null}
          <form onSubmit={(e) => void salvar(e)}>
            <section className="tv-panel tv-campaign-section">
              <div className="tv-section-heading">
                <h2>1. Mensagem e ritmo</h2>
                <Selo valor={form.estado}>{ESTADOS_CAMPANHA[form.estado]}</Selo>
              </div>
              <p>
                O texto inicial é uma sugestão para a Tattoo Week. Selecione somente pessoas cuja
                origem e autorização você conferiu; a base inteira não é classificada como público
                da feira.
              </p>
              <fieldset disabled={!editavel || bloqueado} className="tv-campaign-fields">
                <fieldset className="tv-campaign-mode">
                  <legend>Como enviar</legend>
                  <label className="tv-campaign-confirm">
                    <input
                      type="radio"
                      name="modo-envio"
                      checked={manual}
                      onChange={() => alterar({ modo: 'manual' })}
                    />
                    <span>
                      <strong>Manual pelo WhatsApp Web</strong> — cada contato tem um botão que abre
                      a conversa com o texto pronto; você confere e clica enviar.
                    </span>
                  </label>
                  <label className="tv-campaign-confirm">
                    <input
                      type="radio"
                      name="modo-envio"
                      checked={!manual}
                      onChange={() => alterar({ modo: 'api' })}
                    />
                    <span>
                      <strong>API oficial da Meta</strong> — envio automático com modelo aprovado.
                      Exige a conta WhatsApp Business API configurada.
                    </span>
                  </label>
                </fieldset>
                <label className="tv-field">
                  <span>Título da campanha</span>
                  <input
                    maxLength={160}
                    value={form.titulo}
                    onChange={(e) => alterar({ titulo: e.target.value })}
                  />
                </label>
                <label className="tv-field">
                  <span>Mensagem para revisão</span>
                  <textarea
                    rows={10}
                    maxLength={4000}
                    value={form.mensagem}
                    onChange={(e) => alterar({ mensagem: e.target.value })}
                  />
                </label>
                <p className="tv-help-text">
                  O vídeo é compartilhado como link. Não há resumo de áudio ou promessa de
                  resultado.{' '}
                  {manual
                    ? 'No envio manual, este é exatamente o texto que aparece no WhatsApp.'
                    : 'Para envio, o texto precisa corresponder ao modelo aprovado escolhido abaixo.'}
                </p>
                <div className="tv-campaign-grid">
                  {(
                    [
                      ['intervaloSegundos', 'Intervalo entre mensagens (segundos)', 60, 86400],
                      ['loteTamanho', 'Mensagens por lote', 1, 100],
                      ['pausaLoteSegundos', 'Pausa entre lotes (segundos)', 60, 86400],
                      ['tetoDiario', 'Teto diário de tentativas', 1, 2000],
                    ] as const
                  ).map(([chave, rotulo, min, max]) => (
                    <label className="tv-field" key={chave}>
                      <span>{rotulo}</span>
                      <input
                        type="number"
                        min={min}
                        max={max}
                        step="1"
                        value={form.cadencia[chave]}
                        onChange={(e) =>
                          alterar({
                            cadencia: { ...form.cadencia, [chave]: Number(e.target.value) },
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
                <div className="tv-campaign-grid">
                  {(
                    [
                      ['inicioManha', 'Início da manhã'],
                      ['fimManha', 'Fim da manhã'],
                      ['inicioTarde', 'Início da tarde'],
                      ['fimTarde', 'Fim da tarde'],
                    ] as const
                  ).map(([chave, rotulo]) => (
                    <label className="tv-field" key={chave}>
                      <span>{rotulo}</span>
                      <input
                        type="time"
                        value={form.cadencia[chave]}
                        onChange={(e) =>
                          alterar({ cadencia: { ...form.cadencia, [chave]: e.target.value } })
                        }
                      />
                    </label>
                  ))}
                </div>
              </fieldset>
              <p className="tv-help-text">
                Dias úteis, fuso de São Paulo. O ritmo e o teto são compartilhados entre campanhas;
                trocar de campanha não zera a contagem. Estes valores são escolhas operacionais e
                não garantem ausência de bloqueio.
              </p>
            </section>
            <section className="tv-panel tv-campaign-section">
              <h2>2. Selecionar os contatos</h2>
              <p>
                <strong>
                  {form.contatosIds.length} de até {config?.limitePublico ?? 2000} contatos
                  selecionados.
                </strong>{' '}
                A seleção é explícita. Nenhuma busca adiciona pessoas automaticamente e nenhuma
                marcação cria consentimento.
              </p>
              <div
                className="tv-campaign-grid tv-campaign-filters"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    buscar(e);
                  }
                }}
              >
                {(
                  [
                    ['q', 'Buscar contato por nome'],
                    ['tag', 'Tag do contato'],
                  ] as const
                ).map(([chave, rotulo]) => (
                  <label className="tv-field" key={chave}>
                    <span>{rotulo}</span>
                    <input
                      value={filtros[chave]}
                      onChange={(e) => setFiltros({ ...filtros, [chave]: e.target.value })}
                    />
                  </label>
                ))}
                <label className="tv-field">
                  <span>Origem do contato</span>
                  <select
                    value={filtros.origem}
                    onChange={(e) => setFiltros({ ...filtros, origem: e.target.value })}
                  >
                    <option value="">Todas as origens</option>
                    <option value="manual">Digitado</option>
                    <option value="qr_proprio">Autocadastro QR</option>
                    <option value="qr_lido">QR lido</option>
                    <option value="google_forms">Google Forms</option>
                    <option value="importado">Importação</option>
                  </select>
                </label>
                <label className="tv-field">
                  <span>Criado a partir de</span>
                  <input
                    type="date"
                    value={filtros.de}
                    onChange={(e) => setFiltros({ ...filtros, de: e.target.value })}
                  />
                </label>
                <label className="tv-field">
                  <span>Criado até</span>
                  <input
                    type="date"
                    value={filtros.ate}
                    onChange={(e) => setFiltros({ ...filtros, ate: e.target.value })}
                  />
                </label>
              </div>
              <div className="tv-campaign-actions">
                <button
                  type="button"
                  className="tv-button tv-button-light"
                  onClick={(e) => buscar(e)}
                >
                  Buscar contatos
                </button>
                {editavel ? (
                  <>
                    <button
                      type="button"
                      className="tv-small-button"
                      disabled={
                        bloqueado ||
                        !candidatos?.registros.some((c) => c.elegivel) ||
                        form.contatosIds.length >= (config?.limitePublico ?? 2000)
                      }
                      onClick={selecionarPagina}
                    >
                      Selecionar elegíveis desta página
                    </button>
                    <button
                      type="button"
                      className="tv-small-button"
                      disabled={bloqueado || !form.contatosIds.length}
                      onClick={() => alterar({ contatosIds: [] })}
                    >
                      Limpar seleção
                    </button>
                  </>
                ) : null}
              </div>
              {erroCandidatos ? (
                <p role="alert" className="tv-inline-error">
                  {erroCandidatos}
                </p>
              ) : null}
              <div className="tv-campaign-candidates">
                {candidatos?.registros.map((c) => (
                  <label
                    className={`tv-campaign-candidate ${c.elegivel ? '' : 'is-excluded'}`}
                    key={c.id}
                  >
                    <input
                      type="checkbox"
                      checked={form.contatosIds.includes(c.id)}
                      disabled={
                        !editavel ||
                        bloqueado ||
                        (!c.elegivel && !form.contatosIds.includes(c.id)) ||
                        (!form.contatosIds.includes(c.id) &&
                          form.contatosIds.length >= (config?.limitePublico ?? 2000))
                      }
                      onChange={(e) => escolher(c, e.target.checked)}
                      aria-label={`Selecionar ${c.nome}`}
                    />
                    <span>
                      <strong>{c.nome}</strong>
                      <span>
                        {c.telefoneMascarado || 'Telefone não disponível'} ·{' '}
                        {c.origem || 'Origem não informada'}
                      </span>
                      <small>
                        {c.elegivel
                          ? 'Autorização e telefone conferidos nesta consulta'
                          : motivoCampanha(c.motivo)}
                      </small>
                      {c.tags.length ? <small>Tags: {c.tags.join(', ')}</small> : null}
                    </span>
                  </label>
                ))}
              </div>
              {candidatos?.total === 0 ? (
                <p>Nenhum contato corresponde aos filtros. Limpe a busca ou ajuste o período.</p>
              ) : null}
              {candidatos ? (
                <Paginacao
                  pagina={paginaCandidatos}
                  total={candidatos.total}
                  limite={candidatos.limite}
                  alterar={setPaginaCandidatos}
                  nome="contatos"
                />
              ) : null}
            </section>
            {manual ? (
              <section className="tv-panel tv-campaign-section">
                <h2>3. Modelo da Meta</h2>
                <p>
                  Não é necessário no envio manual. Quando a API oficial for contratada, escolha
                  &quot;API oficial da Meta&quot; em &quot;Como enviar&quot; para usar um modelo
                  aprovado e o envio automático.
                </p>
              </section>
            ) : null}
            <section className="tv-panel tv-campaign-section" hidden={manual}>
              <h2>3. Escolher um modelo aprovado</h2>
              <p>
                O WhatsApp exige um modelo de marketing aprovado na conta da empresa. Nesta versão,
                aceitamos texto simples sem campos variáveis, cabeçalhos ou botões. Digitar uma
                mensagem não a transforma em modelo aprovado.
              </p>
              <button
                type="button"
                className="tv-button tv-button-light"
                disabled={!editavel || bloqueado || !consultaModelosDisponivel}
                onClick={() => void consultarModelos()}
              >
                Consultar modelos na Meta
              </button>
              {!consultaModelosDisponivel ? (
                <p className="tv-help-text">
                  A consulta ficará disponível quando a administração conectar a conta empresarial.
                  Você pode continuar salvando o rascunho.
                </p>
              ) : null}
              {modelosConsultados && !modelos.length ? (
                <p>
                  Nenhum modelo de marketing aprovado compatível com texto simples foi encontrado.
                </p>
              ) : null}
              <label className="tv-field">
                <span>Modelo de marketing</span>
                <select
                  disabled={!editavel || bloqueado || !modelos.length}
                  value={form.template ? `${form.template.id}:${form.template.idioma}` : ''}
                  onChange={(e) =>
                    alterar({
                      template:
                        modelos.find((m) => `${m.id}:${m.idioma}` === e.target.value) ?? null,
                    })
                  }
                >
                  <option value="">Escolher após consultar a Meta</option>
                  {form.template &&
                  !modelos.some(
                    (m) => m.id === form.template?.id && m.idioma === form.template.idioma,
                  ) ? (
                    <option value={`${form.template.id}:${form.template.idioma}`}>
                      {form.template.nome} · {form.template.idioma} · seleção salva
                    </option>
                  ) : null}
                  {modelos.map((m) => (
                    <option key={`${m.id}:${m.idioma}`} value={`${m.id}:${m.idioma}`}>
                      {m.nome} · {m.idioma}
                    </option>
                  ))}
                </select>
              </label>
              {form.template ? (
                <>
                  <pre className="tv-campaign-message">{form.template.corpo}</pre>
                  <p>
                    {mensagemCompativel
                      ? 'O texto da mensagem corresponde ao modelo selecionado. O servidor verificará a aprovação novamente.'
                      : 'A mensagem é diferente deste modelo. Ajuste o rascunho ou use o texto aprovado antes de preparar.'}
                  </p>
                  {editavel ? (
                    <button
                      type="button"
                      className="tv-small-button"
                      disabled={bloqueado}
                      onClick={() => alterar({ mensagem: form.template!.corpo })}
                    >
                      Usar texto deste modelo
                    </button>
                  ) : null}
                </>
              ) : null}
            </section>
            <div className="tv-campaign-save">
              <p>
                {dirty
                  ? 'Existem alterações sem salvar. Salve antes de consultar a prévia ou preparar.'
                  : salva
                    ? `Versão ${salva.versao} salva no servidor.`
                    : 'Este rascunho ainda não foi salvo no servidor.'}
              </p>
              {editavel ? (
                <button
                  className="tv-button tv-button-primary"
                  type="submit"
                  disabled={bloqueado || conflito}
                >
                  {ocupado === 'salvar' ? 'Salvando…' : 'Salvar rascunho'}
                </button>
              ) : (
                <p>O conteúdo e o público foram congelados na preparação.</p>
              )}
            </div>
          </form>
          <section className="tv-panel tv-campaign-section">
            <h2>4. Revisar e preparar</h2>
            <button
              className="tv-button tv-button-light"
              disabled={!prontoAcoes}
              onClick={() => void consultarPrevia()}
            >
              Consultar prévia salva
            </button>
            {previa ? (
              <>
                <div className="tv-campaign-metrics" aria-label="Resumo da prévia">
                  <span>
                    Selecionados <strong>{previa.selecionados}</strong>
                  </span>
                  <span>
                    Elegíveis <strong>{previa.elegiveis}</strong>
                  </span>
                  <span>
                    Excluídos <strong>{previa.excluidos}</strong>
                  </span>
                  <span>
                    Telefones repetidos <strong>{previa.duplicados}</strong>
                  </span>
                </div>
                <pre className="tv-campaign-message">{previa.mensagem}</pre>
                <ul className="tv-campaign-preview">
                  {previa.destinatarios.map((d) => (
                    <li key={d.contatoId}>
                      <strong>{d.nome}</strong> · {d.telefoneMascarado || 'Sem telefone'}
                      <br />
                      <span>
                        {d.elegivel ? 'Elegível nesta revisão' : motivoCampanha(d.motivo)}
                      </span>
                    </li>
                  ))}
                </ul>
                {!manual && !previa.templateCompativel ? (
                  <p className="tv-campaign-warning">
                    Selecione um modelo e confira a correspondência da mensagem antes de preparar.
                  </p>
                ) : null}
              </>
            ) : (
              <p>
                Consulte a versão salva para ver as exclusões e a deduplicação. A autorização será
                verificada novamente antes de cada saída.
              </p>
            )}
            {['rascunho', 'preparando'].includes(form.estado) ? (
              <button
                className="tv-button tv-button-primary"
                disabled={
                  !prontoAcoes || !previa?.elegiveis || (!manual && !previa.templateCompativel)
                }
                onClick={() => void acao('preparar')}
              >
                {form.estado === 'preparando' ? 'Retomar preparação' : 'Preparar público'}
              </button>
            ) : null}
            <p className="tv-help-text">
              {manual
                ? 'Preparar congela o texto e o público e libera o botão "Enviar pelo WhatsApp" em cada contato. Nada é enviado sozinho.'
                : 'Preparar congela o texto e o público. Requer um modelo verificado; não inicia envios, mesmo com o ambiente habilitado.'}
            </p>
          </section>
          <section className="tv-panel tv-campaign-section">
            <h2>5. Operação e resultados</h2>
            <div className="tv-campaign-actions">
              {form.estado === 'preparada' && !manual ? (
                <button
                  className="tv-button tv-button-primary"
                  disabled={!prontoAcoes || !config?.envioAtivo || !config.configuracaoCompleta}
                  onClick={() => void abrirConfirmacao('iniciar')}
                >
                  Revisar início dos envios
                </button>
              ) : null}
              {form.estado === 'em_andamento' ? (
                <button
                  className="tv-button tv-button-light"
                  disabled={!prontoAcoes}
                  onClick={() => void acao('pausar')}
                >
                  Pausar campanha
                </button>
              ) : null}
              {form.estado === 'pausada' ? (
                <button
                  className="tv-button tv-button-primary"
                  disabled={!prontoAcoes || !config?.envioAtivo || !config.configuracaoCompleta}
                  onClick={() => void abrirConfirmacao('retomar')}
                >
                  Revisar retomada
                </button>
              ) : null}
              {!['cancelada', 'concluida'].includes(form.estado) && salva ? (
                <button
                  className="tv-button tv-button-light"
                  disabled={!prontoAcoes}
                  onClick={() => void abrirConfirmacao('cancelar')}
                >
                  Cancelar campanha
                </button>
              ) : null}
            </div>
            {manual ? (
              <p>
                Clique em &quot;Enviar pelo WhatsApp&quot; em um contato por vez. O WhatsApp abre
                com o texto pronto e o envio só acontece quando você clica enviar lá. Entre um
                contato e outro há um intervalo de {form.cadencia.intervaloSegundos}s para o
                WhatsApp não entender como envio em massa.
              </p>
            ) : (
              <p>
                Pausar ou cancelar impede novas saídas; uma requisição já em andamento pode
                terminar. Retomar não recria mensagens aceitas. Resultados incertos exigem
                conferência na Meta, sem repetição automática.
              </p>
            )}
            {linkManual ? (
              <p className="tv-campaign-warning" role="status">
                O navegador bloqueou a nova aba.{' '}
                <a href={linkManual.url} target="_blank" rel="noopener noreferrer">
                  Abrir conversa com {linkManual.nome} no WhatsApp
                </a>
              </p>
            ) : null}
            {resultados ? (
              <>
                <p>{resultados.aviso}</p>
                {manual && form.estado === 'preparada' ? (
                  <p className="tv-campaign-timer" role="status" aria-live="polite">
                    {esperaManual > 0
                      ? `Próximo contato liberado em ${esperaManual}s.`
                      : 'Próximo contato liberado.'}
                  </p>
                ) : null}
                <div className="tv-campaign-metrics">
                  {Object.entries(resultados.resumo).map(([estado, total]) => (
                    <span key={estado}>
                      {ESTADOS_CAMPANHA[estado] ?? estado} <strong>{total}</strong>
                    </span>
                  ))}
                  {!manual ? (
                    <span>
                      Resposta recebida <strong>{resultados.respondidos}</strong>
                    </span>
                  ) : null}
                </div>
                {!manual ? (
                  <p>
                    Tentativas hoje entre campanhas: {resultados.diario}. Próxima saída global
                    disponível: {dataHora(resultados.proximaSaidaEm)}. Horários, pausas e limites
                    ainda se aplicam.
                  </p>
                ) : null}
                <div className="tv-campaign-candidates">
                  {resultados.registros.map((r) => (
                    <article className="tv-campaign-result" key={r._id}>
                      <strong>{r.nome ?? r.telefoneMascarado}</strong>
                      {r.nome ? <span>{r.telefoneMascarado}</span> : null}
                      <Selo valor={r.estado}>{ESTADOS_CAMPANHA[r.estado] ?? r.estado}</Selo>
                      {manual ? (
                        <span>Aberturas: {r.tentativas}</span>
                      ) : (
                        <span>Tentativas: {r.tentativas}</span>
                      )}
                      {manual &&
                      form.estado === 'preparada' &&
                      ['pendente', 'aberto_manual'].includes(r.estado) ? (
                        <button
                          type="button"
                          className={
                            r.estado === 'pendente'
                              ? 'tv-button tv-button-primary'
                              : 'tv-small-button'
                          }
                          disabled={
                            bloqueado || dirty || (r.estado === 'pendente' && esperaManual > 0)
                          }
                          onClick={() => void enviarManual(r._id, r.nome ?? 'o contato')}
                          aria-label={`${r.estado === 'pendente' ? 'Enviar pelo WhatsApp' : 'Abrir de novo no WhatsApp'}: ${r.nome ?? r.telefoneMascarado}`}
                        >
                          {ocupado === `manual:${r._id}`
                            ? 'Abrindo…'
                            : r.estado === 'pendente'
                              ? 'Enviar pelo WhatsApp'
                              : 'Abrir de novo'}
                        </button>
                      ) : null}
                      {manual ? (
                        <div className="tv-row-actions">
                          <button
                            type="button"
                            className="tv-small-button"
                            disabled={ocupado === `atualizacao:${r.contatoId}`}
                            onClick={() =>
                              void gerarLinkAtualizacao(r.contatoId, r.nome ?? 'o contato')
                            }
                          >
                            {ocupado === `atualizacao:${r.contatoId}`
                              ? 'Gerando…'
                              : 'Gerar link de atualização'}
                          </button>
                          {linksAtualizacao[r.contatoId] ? (
                            <input
                              className="tv-link-output"
                              aria-label={`Link de atualização: ${r.nome ?? r.telefoneMascarado}`}
                              readOnly
                              value={linksAtualizacao[r.contatoId]}
                              onFocus={(evento) => evento.currentTarget.select()}
                            />
                          ) : null}
                        </div>
                      ) : null}
                      {r.motivo ? <span>{motivoCampanha(r.motivo)}</span> : null}
                      {r.respondeuEm ? (
                        <strong>Resposta recebida em {dataHora(r.respondeuEm)}</strong>
                      ) : null}
                    </article>
                  ))}
                </div>
                <Paginacao
                  pagina={paginaResultados}
                  total={resultados.total}
                  limite={resultados.limite}
                  alterar={setPaginaResultados}
                  nome="resultados"
                />
              </>
            ) : (
              <p>
                Salve a campanha para acompanhar os resultados. Nenhuma mensagem é enviada ao salvar
                um rascunho.
              </p>
            )}
          </section>
          {salva ? (
            <section className="tv-panel tv-campaign-section">
              <details>
                <summary>Histórico das operações</summary>
                <ul>
                  {eventos.map((e, i) => (
                    <li key={`${e.versao}-${i}`}>
                      {e.acao.replaceAll('_', ' ')} · versão {e.versao} · {dataHora(e.em)} ·
                      responsável registrado
                    </li>
                  ))}
                </ul>
              </details>
            </section>
          ) : null}
        </>
      )}
      {confirmacao ? (
        <Modal
          titulo={
            confirmacao === 'cancelar'
              ? 'Cancelar esta campanha?'
              : confirmacao === 'retomar'
                ? 'Confirmar retomada dos envios'
                : 'Confirmar início dos envios'
          }
          aoFechar={() => setConfirmacao(null)}
          bloqueado={Boolean(ocupado)}
        >
          <div className="tv-modal-body tv-campaign-section">
            <h3>{form.titulo}</h3>
            {confirmacao === 'cancelar' ? (
              <p>
                Novas saídas serão canceladas. Mensagens já aceitas e o histórico permanecem; uma
                requisição em andamento pode terminar.
              </p>
            ) : (
              <>
                <p>
                  Modelo: {form.template?.nome} · {form.template?.idioma}. {previa?.elegiveis ?? 0}{' '}
                  contatos elegíveis nesta revisão.
                </p>
                <p>
                  Intervalo {form.cadencia.intervaloSegundos}s, lotes de {form.cadencia.loteTamanho}
                  , pausa {form.cadencia.pausaLoteSegundos}s e teto diário{' '}
                  {form.cadencia.tetoDiario}, em dias úteis de São Paulo.
                </p>
                <p>
                  O texto enviado será o modelo aprovado, e a elegibilidade será conferida
                  novamente. Esta ação inicia mensagens reais quando o ambiente estiver habilitado.
                </p>
                <label className="tv-campaign-confirm">
                  <input
                    type="checkbox"
                    checked={conferiu}
                    onChange={(e) => setConferiu(e.target.checked)}
                  />
                  Revisei público, modelo e condições e confirmo o início dos envios.
                </label>
              </>
            )}
            {erro ? (
              <p className="tv-inline-error" role="alert">
                {erro}
              </p>
            ) : null}
          </div>
          <div className="tv-modal-footer">
            <button
              className="tv-button tv-button-light"
              disabled={Boolean(ocupado)}
              onClick={() => setConfirmacao(null)}
            >
              Voltar à revisão
            </button>
            <button
              className="tv-button tv-button-primary"
              disabled={Boolean(ocupado) || (confirmacao !== 'cancelar' && !conferiu)}
              onClick={() => void acao(confirmacao)}
            >
              {confirmacao === 'cancelar'
                ? 'Confirmar cancelamento'
                : confirmacao === 'retomar'
                  ? 'Confirmar retomada'
                  : 'Confirmar início'}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function Paginacao({
  pagina,
  total,
  limite,
  alterar,
  nome,
}: {
  pagina: number;
  total: number;
  limite: number;
  alterar: (pagina: number) => void;
  nome: string;
}) {
  return (
    <nav className="tv-pagination tv-campaign-pagination" aria-label={`Páginas de ${nome}`}>
      <span>
        {total} {nome} · Página {pagina}
      </span>
      <div>
        <button
          type="button"
          className="tv-small-button"
          disabled={pagina <= 1}
          onClick={() => alterar(pagina - 1)}
          aria-label={`Página anterior de ${nome}`}
        >
          Anterior
        </button>
        <button
          type="button"
          className="tv-small-button"
          disabled={pagina * limite >= total}
          onClick={() => alterar(pagina + 1)}
          aria-label={`Próxima página de ${nome}`}
        >
          Próxima
        </button>
      </div>
    </nav>
  );
}
