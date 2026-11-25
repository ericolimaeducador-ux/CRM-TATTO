import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { urlDaApi } from '@/lib/api-url';
import { textoDaResposta } from '@/lib/texto-resposta';
import { lerTodos, observarFila } from '@/lib/offline/fila';
import {
  cabecalhosDaSessao,
  perfilLogado,
  podeAuditar,
  podeGerir,
  tokenDaSessao,
} from '@/lib/offline/sessao';
import type { ContatoLocal } from '@/lib/offline/tipos';
import { IndicadorSincronizacao } from './IndicadorSincronizacao';
import { AtribuirContatos } from './AtribuirContatos';
import { useEquipe } from '../comercial/api';

interface ContatoRemoto {
  _id: string;
  idLocal?: string;
  nome?: string;
  status?: string;
  criadoEm?: string;
  responsavel?: string;
}

interface PaginaRemota {
  sessao: string;
  itens: ContatoRemoto[];
  total: number | null;
  cursor: string | null;
  carregando: boolean;
  consultado: boolean;
  erro: string;
}

type Ordem = 'recente' | 'antigo' | 'nome';

interface FiltrosDaLista {
  q: string;
  desde: string;
  ate: string;
  ordem: Ordem;
  responsavel: string;
}

const FILTROS_INICIAIS: FiltrosDaLista = {
  q: '',
  desde: '',
  ate: '',
  ordem: 'recente',
  responsavel: '',
};

function chaveDaSessao(): string {
  const token = tokenDaSessao();
  const perfil = perfilLogado();
  return token ? JSON.stringify([token, perfil?.id, perfil?.papel]) : '';
}

function paginaVazia(sessao: string): PaginaRemota {
  return {
    sessao,
    itens: [],
    total: null,
    cursor: null,
    carregando: false,
    consultado: false,
    erro: '',
  };
}

export function ListaContatos() {
  const [itens, setItens] = useState<ContatoLocal[]>([]);
  const [erroLocal, setErroLocal] = useState('');
  const [sessao, setSessao] = useState(chaveDaSessao);
  const [pagina, setPagina] = useState(() => paginaVazia(sessao));
  // A busca do topo chega como ?q= (ADR-026).
  const [parametrosDaUrl] = useSearchParams();
  const qDaUrl = parametrosDaUrl.get('q') ?? '';
  const [filtros, setFiltros] = useState<FiltrosDaLista>(() => ({
    ...FILTROS_INICIAIS,
    q: qDaUrl,
  }));
  const [rascunhoDeFiltros, setRascunhoDeFiltros] = useState<FiltrosDaLista>(() => ({
    ...FILTROS_INICIAIS,
    q: qDaUrl,
  }));
  useEffect(() => {
    setFiltros((atual) => (atual.q === qDaUrl ? atual : { ...atual, q: qDaUrl }));
    setRascunhoDeFiltros((atual) => (atual.q === qDaUrl ? atual : { ...atual, q: qDaUrl }));
  }, [qDaUrl]);
  const gestao = podeGerir();
  const { equipe } = useEquipe(gestao && Boolean(sessao));
  const [selecionados, setSelecionados] = useState<Set<string>>(() => new Set());
  const [aviso, setAviso] = useState('');
  const consulta = useRef<AbortController | null>(null);
  const geracao = useRef(0);

  const carregar = useCallback(
    async (cursor?: string) => {
      if (!sessao || sessao !== chaveDaSessao() || consulta.current) return;
      const controle = new AbortController();
      consulta.current = controle;
      const atual = ++geracao.current;
      const vigente = () =>
        !controle.signal.aborted && geracao.current === atual && chaveDaSessao() === sessao;
      let acessoNegado = false;
      setPagina((anterior) => ({ ...anterior, carregando: true, erro: '' }));
      try {
        if (!navigator.onLine)
          throw new Error(
            'Sem conexão para consultar o CRM. Os contatos deste aparelho continuam disponíveis.',
          );
        const parametros = new URLSearchParams({ limite: '20', ordem: filtros.ordem });
        if (filtros.q) parametros.set('q', filtros.q);
        if (filtros.desde) parametros.set('desde', filtros.desde);
        if (filtros.ate) parametros.set('ate', filtros.ate);
        if (filtros.responsavel) parametros.set('responsavel', filtros.responsavel);
        if (cursor) parametros.set('cursor', cursor);
        const resposta = await fetch(urlDaApi(`/v1/contatos?${parametros}`), {
          headers: cabecalhosDaSessao(),
          signal: controle.signal,
        });
        acessoNegado = resposta.status === 401 || resposta.status === 403;
        const json = (await resposta.json()) as {
          dados?: (ContatoRemoto & { origem?: { vendedorAtribuido?: unknown } })[];
          proximoCursor?: string | null;
          total?: number;
          mensagem?: string;
          erros?: { mensagem?: string }[];
        };
        if (!resposta.ok)
          throw new Error(
            textoDaResposta(
              json,
              'Não consegui consultar os contatos do CRM. Entre novamente ou tente atualizar.',
            ),
          );
        if (!Array.isArray(json.dados))
          throw new Error('Não consegui ler a lista do CRM. Tente atualizar.');
        if (!vigente()) return;
        const recebidos = json.dados.map(({ _id, idLocal, nome, status, criadoEm, origem }) => ({
          _id,
          idLocal,
          nome,
          status,
          criadoEm,
          responsavel: origem?.vendedorAtribuido ? String(origem.vendedorAtribuido) : undefined,
        }));
        setPagina((anterior) => {
          const acumulados = cursor ? [...anterior.itens, ...recebidos] : recebidos;
          const ids = new Set<string>();
          const locais = new Set<string>();
          const unicos = acumulados.filter((item) => {
            if (!item._id || ids.has(item._id) || (item.idLocal && locais.has(item.idLocal)))
              return false;
            ids.add(item._id);
            if (item.idLocal) locais.add(item.idLocal);
            return true;
          });
          return {
            sessao,
            itens: unicos,
            total: typeof json.total === 'number' ? json.total : anterior.total,
            cursor:
              typeof json.proximoCursor === 'string' && json.proximoCursor !== cursor
                ? json.proximoCursor
                : null,
            carregando: false,
            consultado: true,
            erro: '',
          };
        });
      } catch (erro) {
        if (vigente())
          setPagina((anterior) => ({
            ...(acessoNegado ? paginaVazia(sessao) : anterior),
            carregando: false,
            erro:
              erro instanceof Error && !(erro instanceof TypeError)
                ? erro.message
                : 'Não consegui consultar o CRM. Confira sua conexão e tente novamente.',
          }));
      } finally {
        if (geracao.current === atual) consulta.current = null;
      }
    },
    [filtros, sessao],
  );

  useEffect(() => {
    const trocar = () => {
      const nova = chaveDaSessao();
      if (nova === sessao) return;
      consulta.current?.abort();
      consulta.current = null;
      geracao.current += 1;
      setPagina(paginaVazia(nova));
      setSessao(nova);
    };
    window.addEventListener('tela-viva-sessao', trocar);
    window.addEventListener('storage', trocar);
    return () => {
      window.removeEventListener('tela-viva-sessao', trocar);
      window.removeEventListener('storage', trocar);
    };
  }, [sessao]);

  useEffect(() => {
    setPagina(paginaVazia(sessao));
    void carregar();
    const reconectar = () => void carregar();
    window.addEventListener('online', reconectar);
    return () => {
      consulta.current?.abort();
      consulta.current = null;
      geracao.current += 1;
      window.removeEventListener('online', reconectar);
    };
  }, [carregar]);

  useEffect(() => {
    let ativo = true;
    let leitura = 0;
    const atualizar = () => {
      const atual = ++leitura;
      void lerTodos()
        .then((contatos) => {
          if (ativo && leitura === atual) {
            setItens(contatos);
            setErroLocal('');
          }
        })
        .catch(() => {
          if (ativo && leitura === atual)
            setErroLocal('Não consegui ler os contatos deste aparelho. Tente reabrir esta tela.');
        });
    };
    atualizar();
    const parar = observarFila(atualizar);
    return () => {
      ativo = false;
      parar();
    };
  }, []);

  const idsLocais = new Set<string>();
  const idsServidor = new Set<string>();
  // Primeiro deduplica dando prioridade à edição pendente (mais nova) sobre a cópia
  // já sincronizada; só depois filtra e ordena o que aparece na tela.
  const locais = [...itens]
    .sort(
      (a, b) =>
        Number(a.estado === 'sincronizado') - Number(b.estado === 'sincronizado') ||
        b.atualizadoEm - a.atualizadoEm,
    )
    .filter((item) => {
      if (idsLocais.has(item.idLocal) || (item.idServidor && idsServidor.has(item.idServidor)))
        return false;
      idsLocais.add(item.idLocal);
      if (item.idServidor) idsServidor.add(item.idServidor);
      return true;
    })
    .filter((item) => correspondeAosFiltrosLocais(item, filtros))
    .sort((a, b) => compararLocais(a, b, filtros.ordem));
  const remota =
    pagina.sessao === sessao && sessao === chaveDaSessao() ? pagina : paginaVazia(sessao);
  const pendentes = locais.filter((item) => !item.idServidor).length;
  const remotos = remota.itens.filter(
    (item) => !idsServidor.has(item._id) && (!item.idLocal || !idsLocais.has(item.idLocal)),
  );

  const aplicarFiltros = (evento: React.FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    setFiltros(rascunhoDeFiltros);
  };

  const limparFiltros = () => {
    setRascunhoDeFiltros(FILTROS_INICIAIS);
    setFiltros(FILTROS_INICIAIS);
  };

  return (
    <section className="flex flex-col gap-4">
      <Link className="atalho" to="/capturar">
        Captura
      </Link>
      <h1 className="text-2xl font-semibold">Contatos</h1>
      {sessao && remota.total !== null ? (
        <p className="text-lg font-semibold" data-testid="total-contatos">
          {formatarNumero(remota.total)} {remota.total === 1 ? 'contato' : 'contatos'} no CRM
          {pendentes ? ` · ${formatarNumero(pendentes)} neste aparelho aguardando envio` : ''}
        </p>
      ) : null}
      {erroLocal ? <p role="alert">{erroLocal}</p> : null}
      {!sessao ? (
        <p className="text-base">
          {locais.length === 0 ? 'Nenhum contato neste aparelho. ' : ''}
          <Link className="underline" to="/entrar">
            Entre para consultar os contatos do CRM.
          </Link>
        </p>
      ) : null}
      {remota.carregando ? <p role="status">Carregando contatos do CRM…</p> : null}
      {remota.erro ? <p role="alert">{remota.erro}</p> : null}
      <form
        className="grid gap-3 rounded border border-stone-300 p-3 sm:grid-cols-2"
        onSubmit={aplicarFiltros}
      >
        <label className="flex flex-col gap-1 text-base sm:col-span-2">
          Buscar por nome ou dado de contato
          <input
            className="campo"
            type="search"
            value={rascunhoDeFiltros.q}
            onChange={(evento) =>
              setRascunhoDeFiltros((anterior) => ({ ...anterior, q: evento.target.value }))
            }
            placeholder="Nome, e-mail ou telefone"
          />
        </label>
        <label className="flex flex-col gap-1 text-base">
          Data de entrada — de
          <input
            className="campo"
            type="date"
            value={rascunhoDeFiltros.desde}
            onChange={(evento) =>
              setRascunhoDeFiltros((anterior) => ({ ...anterior, desde: evento.target.value }))
            }
          />
        </label>
        <label className="flex flex-col gap-1 text-base">
          Data de entrada — até
          <input
            className="campo"
            type="date"
            value={rascunhoDeFiltros.ate}
            onChange={(evento) =>
              setRascunhoDeFiltros((anterior) => ({ ...anterior, ate: evento.target.value }))
            }
          />
        </label>
        <label className="flex flex-col gap-1 text-base sm:col-span-2">
          Ordenar contatos
          <select
            className="campo"
            value={rascunhoDeFiltros.ordem}
            onChange={(evento) =>
              setRascunhoDeFiltros((anterior) => ({
                ...anterior,
                ordem: evento.target.value as Ordem,
              }))
            }
          >
            <option value="recente">Mais recentes</option>
            <option value="antigo">Mais antigos</option>
            <option value="nome">Nome (A–Z)</option>
          </select>
        </label>
        {gestao ? (
          <label className="flex flex-col gap-1 text-base sm:col-span-2">
            Responsável
            <select
              className="campo"
              value={rascunhoDeFiltros.responsavel}
              onChange={(evento) =>
                setRascunhoDeFiltros((anterior) => ({
                  ...anterior,
                  responsavel: evento.target.value,
                }))
              }
            >
              <option value="">Todos</option>
              <option value="sem">Sem responsável</option>
              {equipe.map((pessoa) => (
                <option key={pessoa.id} value={pessoa.id}>
                  {pessoa.nome}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <button type="submit" className="tv-button">
            Aplicar filtros
          </button>
          <button type="button" className="tv-button tv-button-light" onClick={limparFiltros}>
            Limpar filtros
          </button>
        </div>
      </form>
      {sessao &&
      remota.consultado &&
      locais.length === 0 &&
      remotos.length === 0 &&
      !remota.carregando &&
      !remota.erro ? (
        <p>Nenhum contato encontrado.</p>
      ) : null}
      {sessao ? (
        <button
          type="button"
          className="tv-button tv-button-light"
          disabled={remota.carregando}
          onClick={() => void carregar()}
        >
          Atualizar contatos do CRM
        </button>
      ) : null}
      {aviso ? <p role="status">{aviso}</p> : null}
      {gestao && (remotos.length || locais.some((item) => item.idServidor)) ? (
        <button
          type="button"
          className="tv-button tv-button-light"
          onClick={() =>
            setSelecionados(
              new Set([
                ...remotos.map((item) => item._id),
                ...locais.flatMap((item) => (item.idServidor ? [item.idServidor] : [])),
              ]),
            )
          }
        >
          Selecionar todos os listados
        </button>
      ) : null}
      {gestao && selecionados.size ? (
        <AtribuirContatos
          ids={[...selecionados]}
          equipe={equipe}
          aoLimpar={() => setSelecionados(new Set())}
          aoConcluir={(texto) => {
            setAviso(texto);
            setSelecionados(new Set());
            void carregar();
          }}
        />
      ) : null}
      <ul className="flex flex-col gap-3">
        {locais.map((item) => (
          <li key={item.idLocal} className="rounded border border-stone-300 p-3">
            {gestao && item.idServidor ? (
              <CaixaSelecao
                id={item.idServidor}
                nome={rotulo(item)}
                selecionados={selecionados}
                alterar={setSelecionados}
              />
            ) : null}
            <Link className="text-base underline" to={`/contatos/${item.idLocal}`}>
              {rotulo(item)}
            </Link>
            <IndicadorSincronizacao estado={item.estado} />
            <p className="text-sm text-stone-600">
              Salvo neste aparelho em {dataDeEntrada(new Date(item.atualizadoEm).toISOString())}
            </p>
            {item.idServidor && podeGerir() ? (
              <Link className="mt-2 atalho" to={`/promover/${item.idServidor}`}>
                Promover
              </Link>
            ) : null}
            {item.idServidor && podeAuditar() ? (
              <Link className="mt-2 atalho" to={`/lead/${item.idServidor}`}>
                Abrir lead
              </Link>
            ) : null}
          </li>
        ))}
        {remotos.map((item) => (
          <li key={`crm-${item._id}`} className="rounded border border-stone-300 p-3">
            {gestao ? (
              <CaixaSelecao
                id={item._id}
                nome={item.nome?.trim() || 'contato sem nome'}
                selecionados={selecionados}
                alterar={setSelecionados}
              />
            ) : null}
            <Link
              className="inline-flex min-h-12 items-center break-words text-base underline"
              to={`/lead/${item._id}`}
            >
              {item.nome?.trim() || 'Contato sem nome informado'}
            </Link>
            <p className="text-base">Salvo no CRM{item.status ? ` · ${item.status}` : ''}</p>
            {item.criadoEm ? (
              <p className="text-sm text-stone-600">Entrou em {dataDeEntrada(item.criadoEm)}</p>
            ) : null}
            {gestao ? (
              <p className="text-sm text-stone-600">
                Responsável:{' '}
                {item.responsavel
                  ? (equipe.find((p) => p.id === item.responsavel)?.nome ?? 'pessoa da equipe')
                  : 'ninguém ainda'}
              </p>
            ) : null}
            {podeGerir() ? (
              <Link
                className="mt-2 inline-flex min-h-12 items-center text-base underline"
                to={`/promover/${item._id}`}
              >
                Promover
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
      {sessao && remota.cursor ? (
        <button
          type="button"
          className="tv-button tv-button-light"
          disabled={remota.carregando}
          onClick={() => void carregar(remota.cursor ?? undefined)}
        >
          Carregar mais contatos
        </button>
      ) : null}
    </section>
  );
}

function CaixaSelecao({
  id,
  nome,
  selecionados,
  alterar,
}: {
  id: string;
  nome: string;
  selecionados: Set<string>;
  alterar: React.Dispatch<React.SetStateAction<Set<string>>>;
}) {
  return (
    <label className="mb-1 flex min-h-12 items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="h-5 w-5"
        checked={selecionados.has(id)}
        onChange={(evento) =>
          alterar((anterior) => {
            const proximo = new Set(anterior);
            if (evento.target.checked) proximo.add(id);
            else proximo.delete(id);
            return proximo;
          })
        }
        aria-label={`Selecionar ${nome}`}
      />
      Selecionar
    </label>
  );
}

function rotulo(item: ContatoLocal): string {
  const nome = item.campos.nome?.trim();
  return nome || 'Rascunho local';
}

function formatarNumero(n: number): string {
  return new Intl.NumberFormat('pt-BR').format(n);
}

function dataDeEntrada(valor: string): string {
  const data = new Date(valor);
  if (!Number.isFinite(data.getTime())) return 'data não informada';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(data);
}

function correspondeAosFiltrosLocais(item: ContatoLocal, filtros: FiltrosDaLista): boolean {
  const busca = normalizar(filtros.q);
  const dados = Object.values(item.campos).join(' ');
  if (busca && !normalizar(dados).includes(busca)) return false;
  const data = dataLocal(item.atualizadoEm);
  return (!filtros.desde || data >= filtros.desde) && (!filtros.ate || data <= filtros.ate);
}

function compararLocais(a: ContatoLocal, b: ContatoLocal, ordem: Ordem): number {
  if (ordem === 'nome')
    return rotulo(a).localeCompare(rotulo(b), 'pt-BR', { sensitivity: 'base', numeric: true });
  return ordem === 'antigo' ? a.atualizadoEm - b.atualizadoEm : b.atualizadoEm - a.atualizadoEm;
}

function normalizar(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

function dataLocal(valor: number): string {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(valor));
  const parte = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((item) => item.type === tipo)?.value ?? '';
  return `${parte('year')}-${parte('month')}-${parte('day')}`;
}
