import { useEffect, useState } from 'react';
import { urlDaApi } from '@/lib/api-url';
import { brDeIso, mascararData } from '@/lib/datas';
import { cabecalhosDaSessao } from '@/lib/offline/sessao';

export interface Cadastro {
  _id: string;
  nome?: string;
  status?: string;
  tipoPessoa?: string;
  criadoEm?: string;
  pf?: { cpfMascarado?: string };
  pj?: { cnpjMascarado?: string; razaoSocial?: string };
  lgpd?: { contatoComercial?: string };
  origem?: { modo?: string };
}

export interface Filtros {
  q: string;
  status: string;
  origem: string;
  pessoa: string;
  consentimento: string;
  desde: string;
  ate: string;
  ordem: string;
}

export const VAZIO: Filtros = {
  q: '',
  status: '',
  origem: '',
  pessoa: '',
  consentimento: '',
  desde: '',
  ate: '',
  ordem: 'recente',
};

export const STATUS = ['rascunho', 'capturado', 'qualificado', 'cliente', 'descartado'];

export const ORIGENS = [
  '',
  'manual',
  'qr_lido',
  'qr_proprio',
  'importado',
  'importacao',
  'google_forms',
];
export const PESSOAS = ['', 'PF', 'PJ', 'INDEFINIDO'];
export const CONSENTIMENTOS = ['', 'pendente', 'concedido', 'revogado'];
export const ORDENS = ['recente', 'antigo', 'nome'];

export function Selecao({
  nome,
  rotulo,
  valor,
  opcoes,
  aoMudar,
}: {
  nome: string;
  rotulo: string;
  valor: string;
  opcoes: string[];
  aoMudar: (valor: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-base">
      {rotulo}
      <select
        className="campo"
        name={nome}
        value={valor}
        onChange={(evento) => aoMudar(evento.target.value)}
      >
        {opcoes.map((opcao) => (
          <option key={opcao || 'todos'} value={opcao}>
            {opcao || 'Todos'}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CampoData({
  rotulo,
  valor,
  aoMudar,
}: {
  rotulo: string;
  valor: string;
  aoMudar: (valor: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-base">
      {rotulo}
      <input
        className="campo"
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd/mm/aaaa"
        aria-label={rotulo}
        value={valor}
        onChange={(evento) => aoMudar(mascararData(evento.target.value))}
      />
    </label>
  );
}

export function Status({ valor }: { valor?: string }) {
  const nome = valor && STATUS.includes(valor) ? valor : 'sem status';
  return <span className={`status status-${valor ?? 'outro'}`}>{nome}</span>;
}

export function Vazio() {
  return (
    <div className="cartao vazio">
      <svg className="vazio-desenho" viewBox="0 0 120 80" aria-hidden="true">
        <rect
          x="16"
          y="14"
          width="88"
          height="52"
          rx="12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path d="M32 34h40M32 46h28" stroke="currentColor" strokeWidth="2" />
        <circle cx="86" cy="50" r="12" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M94 58l8 8" stroke="currentColor" strokeWidth="2" />
      </svg>
      <p className="text-base">Nenhum cadastro com esses filtros.</p>
    </div>
  );
}

export function Esqueleto() {
  return (
    <div className="flex flex-col gap-3">
      <div className="esqueleto" />
      <div className="esqueleto" />
      <div className="esqueleto" />
    </div>
  );
}

export function useTabela(): boolean {
  const [larga, setLarga] = useState(() =>
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(min-width: 1024px)').matches
      : false,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(min-width: 1024px)');
    const ouvir = () => setLarga(media.matches);
    media.addEventListener('change', ouvir);
    return () => media.removeEventListener('change', ouvir);
  }, []);
  return larga;
}

export function nomeDe(item: Cadastro): string {
  return item.nome?.trim() || item.pj?.razaoSocial || 'Cadastro sem nome';
}

export function documento(item: Cadastro): string {
  return item.pf?.cpfMascarado || item.pj?.cnpjMascarado || 'sem documento';
}

export function textoContagem(total: number | null, quantidade: number): string {
  const n = total ?? quantidade;
  return n === 1 ? '1 cadastro' : `${n} cadastros`;
}

export function chipsDe(filtros: Filtros): { chave: keyof Filtros; rotulo: string }[] {
  const lista: { chave: keyof Filtros; rotulo: string }[] = [];
  if (filtros.q) lista.push({ chave: 'q', rotulo: filtros.q });
  if (filtros.status) lista.push({ chave: 'status', rotulo: filtros.status });
  if (filtros.origem) lista.push({ chave: 'origem', rotulo: filtros.origem });
  if (filtros.pessoa) lista.push({ chave: 'pessoa', rotulo: filtros.pessoa });
  if (filtros.consentimento) lista.push({ chave: 'consentimento', rotulo: filtros.consentimento });
  if (filtros.desde) lista.push({ chave: 'desde', rotulo: `desde ${brDeIso(filtros.desde)}` });
  if (filtros.ate) lista.push({ chave: 'ate', rotulo: `até ${brDeIso(filtros.ate)}` });
  if (filtros.ordem !== 'recente') lista.push({ chave: 'ordem', rotulo: filtros.ordem });
  return lista;
}

export async function carregar(
  filtros: Filtros,
  cursor: string | null,
  definirItens: (valor: Cadastro[]) => void,
  definirTotal: (valor: number | null) => void,
  definirProximo: (valor: string | null) => void,
  definirMensagem: (valor: string) => void,
  definirCarregando: (valor: boolean) => void,
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
      total?: number;
      proximoCursor?: string | null;
      erros?: { mensagem?: string }[];
      mensagem?: string;
    };
    if (!resposta.ok || !json.dados) {
      definirMensagem(json.erros?.[0]?.mensagem ?? json.mensagem ?? 'Não consegui listar.');
      definirItens([]);
      definirTotal(null);
      definirProximo(null);
      return;
    }
    definirItens(json.dados);
    definirTotal(typeof json.total === 'number' ? json.total : json.dados.length);
    definirProximo(json.proximoCursor ?? null);
  } catch {
    definirMensagem('Não consegui listar.');
    definirItens([]);
    definirTotal(null);
  } finally {
    definirCarregando(false);
  }
}
