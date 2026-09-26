export interface SessaoLocal {
  id: string;
  papel: 'vendedor';
  nome: string;
}

const CHAVE = 'captura7.sessao';

export function sessaoLocal(): SessaoLocal {
  const salva = localStorage.getItem(CHAVE);
  if (salva) return JSON.parse(salva) as SessaoLocal;
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const nova: SessaoLocal = {
    id: [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join(''),
    papel: 'vendedor',
    nome: 'Vendedor deste aparelho',
  };
  localStorage.setItem(CHAVE, JSON.stringify(nova));
  return nova;
}

export function guardarToken(token: string): void {
  localStorage.setItem('captura7.token', token);
}

export function tokenDaSessao(): string {
  return localStorage.getItem('captura7.token') ?? '';
}

export function cabecalhosDaSessao(): Record<string, string> {
  const base: Record<string, string> = { 'content-type': 'application/json' };
  const token = tokenDaSessao();
  if (token) base.authorization = `Bearer ${token}`;
  if (!headersDeTesteNoCliente()) return base;
  const sessao = sessaoLocal();
  return {
    ...base,
    'x-papel-teste': sessao.papel,
    'x-usuario-id': sessao.id,
    'x-autor-nome': sessao.nome,
  };
}

function headersDeTesteNoCliente(): boolean {
  return import.meta.env.MODE === 'test' || import.meta.env.VITE_CAPTURA7_HEADERS_TESTE === '1';
}
