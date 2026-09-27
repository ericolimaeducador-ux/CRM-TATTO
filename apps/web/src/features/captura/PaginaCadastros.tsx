import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { urlDaApi } from '@/lib/api-url';
import { cabecalhosDaSessao, perfilLogado } from '@/lib/offline/sessao';

interface Cadastro {
  _id: string;
  nome?: string;
  status?: string;
  tipoPessoa?: string;
  criadoEm?: string;
  pf?: { cpfMascarado?: string };
  pj?: { cnpjMascarado?: string; razaoSocial?: string };
  lgpd?: { contatoComercial?: string };
  origem?: { modo?: string };
  emails?: { valor?: string }[];
  telefones?: { e164?: string; bruto?: string }[];
}

interface Filtros {
  q: string;
  status: string;
  origem: string;
  pessoa: string;
  consentimento: string;
  desde: string;
  ate: string;
  ordem: string;
}

const VAZIO: Filtros = {
  q: '',
  status: '',
  origem: '',
  pessoa: '',
  consentimento: '',
  desde: '',
  ate: '',
  ordem: 'recente',
};

export function PaginaCadastros() {
  const [filtros, setFiltros] = useState<Filtros>(VAZIO);
  const [itens, setItens] = useState<Cadastro[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState('');
  const [carregando, setCarregando] = useState(false);
  const perfil = perfilLogado();

  useEffect(() => {
    void carregar(filtros, null, setItens, setCursor, setMensagem, setCarregando);
  }, [filtros]);

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-3xl font-semibold">Cadastros</h1>
      <p className="text-base">
        {perfil
          ? 'Leads gravados no servidor. O documento aparece mascarado nesta lista.'
          : 'Entre como gestor ou administrador para ver os cadastros do servidor.'}
      </p>
      <form
        className="grid gap-3 md:grid-cols-2"
        onSubmit={(evento) => {
          evento.preventDefault();
          const dados = new FormData(evento.currentTarget);
          setFiltros({
            q: String(dados.get('q') ?? ''),
            status: String(dados.get('status') ?? ''),
            origem: String(dados.get('origem') ?? ''),
            pessoa: String(dados.get('pessoa') ?? ''),
            consentimento: String(dados.get('consentimento') ?? ''),
            desde: String(dados.get('desde') ?? ''),
            ate: String(dados.get('ate') ?? ''),
            ordem: String(dados.get('ordem') ?? 'recente'),
          });
        }}
      >
        <label className="flex flex-col gap-1 text-base">
          Busca
          <input className="campo" name="q" defaultValue={filtros.q} />
        </label>
        <Selecao nome="status" rotulo="Status" valor={filtros.status} opcoes={STATUS} />
        <Selecao nome="origem" rotulo="Origem" valor={filtros.origem} opcoes={ORIGENS} />
        <Selecao nome="pessoa" rotulo="Pessoa" valor={filtros.pessoa} opcoes={PESSOAS} />
        <Selecao
          nome="consentimento"
          rotulo="Consentimento"
          valor={filtros.consentimento}
          opcoes={CONSENTIMENTOS}
        />
        <label className="flex flex-col gap-1 text-base">
          Desde
          <input className="campo" type="date" name="desde" defaultValue={filtros.desde} />
        </label>
        <label className="flex flex-col gap-1 text-base">
          Até
          <input className="campo" type="date" name="ate" defaultValue={filtros.ate} />
        </label>
        <Selecao nome="ordem" rotulo="Ordem" valor={filtros.ordem} opcoes={ORDENS} />
        <button className="btn" type="submit">
          Filtrar
        </button>
      </form>
      {carregando && itens.length === 0 ? <p className="text-base">Carregando cadastros…</p> : null}
      {mensagem ? <p className="text-base">{mensagem}</p> : null}
      {!carregando && !mensagem && itens.length === 0 ? (
        <p className="cartao text-base">Nenhum cadastro com esses filtros.</p>
      ) : null}
      <ul className="flex flex-col gap-3">
        {itens.map((item) => (
          <li key={item._id} className="cartao grid gap-2 md:grid-cols-6 md:items-center">
            <Link className="atalho md:col-span-2" to={`/lead/${item._id}`}>
              {item.nome?.trim() || item.pj?.razaoSocial || 'Cadastro sem nome'}
            </Link>
            <span className="chip">{item.status ?? 'sem status'}</span>
            <span className="text-sm">{item.tipoPessoa ?? 'INDEFINIDO'}</span>
            <span className="text-sm">{documento(item)}</span>
            <span className="text-sm">
              {item.origem?.modo ?? 'manual'} · {item.lgpd?.contatoComercial ?? 'pendente'}
            </span>
          </li>
        ))}
      </ul>
      {cursor ? (
        <button
          type="button"
          className="btn-secundario"
          onClick={() =>
            void carregar(filtros, cursor, setItens, setCursor, setMensagem, setCarregando, true)
          }
        >
          Carregar mais
        </button>
      ) : null}
    </section>
  );
}

const STATUS = ['', 'rascunho', 'capturado', 'qualificado', 'cliente', 'descartado'];
const ORIGENS = ['', 'manual', 'qr_lido', 'qr_proprio', 'importado', 'importacao', 'google_forms'];
const PESSOAS = ['', 'PF', 'PJ', 'INDEFINIDO'];
const CONSENTIMENTOS = ['', 'pendente', 'concedido', 'revogado'];
const ORDENS = ['recente', 'antigo', 'nome'];

function Selecao({
  nome,
  rotulo,
  valor,
  opcoes,
}: {
  nome: string;
  rotulo: string;
  valor: string;
  opcoes: string[];
}) {
  return (
    <label className="flex flex-col gap-1 text-base">
      {rotulo}
      <select className="campo" name={nome} defaultValue={valor}>
        {opcoes.map((opcao) => (
          <option key={opcao || 'todos'} value={opcao}>
            {opcao || 'Todos'}
          </option>
        ))}
      </select>
    </label>
  );
}

function documento(item: Cadastro): string {
  return item.pf?.cpfMascarado || item.pj?.cnpjMascarado || 'sem documento';
}

async function carregar(
  filtros: Filtros,
  cursor: string | null,
  definirItens: (valor: Cadastro[] | ((atual: Cadastro[]) => Cadastro[])) => void,
  definirCursor: (valor: string | null) => void,
  definirMensagem: (valor: string) => void,
  definirCarregando: (valor: boolean) => void,
  acrescentar = false,
) {
  definirCarregando(true);
  definirMensagem('');
  const params = new URLSearchParams({ limite: '20' });
  for (const [chave, valor] of Object.entries(filtros)) {
    if (valor) params.set(chave, valor);
  }
  if (cursor) params.set('cursor', cursor);
  try {
    const resposta = await fetch(urlDaApi(`/v1/contatos?${params.toString()}`), {
      headers: cabecalhosDaSessao(),
    });
    const json = (await resposta.json()) as {
      dados?: Cadastro[];
      proximoCursor?: string | null;
      erros?: { mensagem?: string }[];
      mensagem?: string;
    };
    if (!resposta.ok || !json.dados) {
      definirMensagem(json.erros?.[0]?.mensagem ?? json.mensagem ?? 'Não consegui listar.');
      if (!acrescentar) definirItens([]);
      definirCursor(null);
      return;
    }
    definirItens((atual) => (acrescentar ? [...atual, ...(json.dados ?? [])] : (json.dados ?? [])));
    definirCursor(json.proximoCursor ?? null);
  } catch {
    definirMensagem('Não consegui listar.');
    if (!acrescentar) definirItens([]);
  } finally {
    definirCarregando(false);
  }
}
