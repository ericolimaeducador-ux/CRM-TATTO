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

export function cabecalhosDaSessao(): Record<string, string> {
  const sessao = sessaoLocal();
  return {
    'content-type': 'application/json',
    'x-papel-teste': sessao.papel,
    'x-usuario-id': sessao.id,
    'x-autor-nome': sessao.nome,
  };
}
