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

const PERFIL = 'captura7.perfil';

export interface PerfilLogado {
  id: string;
  papel: string;
  nome: string;
}

export function guardarPerfil(perfil: PerfilLogado): void {
  localStorage.setItem(PERFIL, JSON.stringify(perfil));
}

export function perfilLogado(): PerfilLogado | null {
  const bruto = localStorage.getItem(PERFIL);
  if (!bruto) return null;
  try {
    const json = JSON.parse(bruto) as PerfilLogado;
    if (!json.papel || !json.nome) return null;
    return json;
  } catch {
    return null;
  }
}

export function podeGerir(): boolean {
  const papel = perfilLogado()?.papel;
  return papel === 'gestor' || papel === 'admin';
}

export function podeAuditar(): boolean {
  const papel = perfilLogado()?.papel;
  return papel === 'gestor' || papel === 'admin' || papel === 'auditor';
}

export function podeExportar(): boolean {
  return perfilLogado()?.papel === 'admin';
}

export function podeImportar(): boolean {
  const papel = perfilLogado()?.papel;
  return papel === 'gestor' || papel === 'admin';
}

export function marcarTotpPendente(pendente: boolean): void {
  if (pendente) localStorage.setItem('captura7.totpPendente', '1');
  else localStorage.removeItem('captura7.totpPendente');
}

export function totpPendenteLocal(): boolean {
  return localStorage.getItem('captura7.totpPendente') === '1';
}

export function limparSessao(): void {
  localStorage.removeItem('captura7.token');
  localStorage.removeItem(PERFIL);
  localStorage.removeItem('captura7.totpPendente');
}

export function codigoTotpDoCorpo(
  codigo: string,
  teste = headersDeTesteNoCliente(),
): string | undefined {
  if (teste) return undefined;
  const limpo = codigo.trim();
  return limpo || undefined;
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

export function headersDeTesteNoCliente(): boolean {
  return import.meta.env.MODE === 'test' || import.meta.env.VITE_CAPTURA7_HEADERS_TESTE === '1';
}
