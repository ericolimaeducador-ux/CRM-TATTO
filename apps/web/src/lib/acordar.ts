export const FRASE_ACORDANDO = 'Servidor acordando, aguarde…';

type Ouvinte = (texto: string) => void;

const ouvintes = new Set<Ouvinte>();

export function observarAcordar(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

function avisar(texto: string): void {
  for (const ouvinte of ouvintes) ouvinte(texto);
}

export function marcarServidorAcordando(acordando: boolean): void {
  avisar(acordando ? FRASE_ACORDANDO : '');
}

export async function fetchComAcordar(
  entrada: string,
  init?: RequestInit,
  aoAvisar: Ouvinte = avisar,
  pausaMs = 400,
): Promise<Response> {
  const primeira = await tentar(entrada, init, 8_000);
  if (primeira && !servidorLento(primeira)) return primeira;
  aoAvisar(FRASE_ACORDANDO);
  avisar(FRASE_ACORDANDO);
  await esperar(pausaMs);
  const segunda = await tentar(entrada, init, 45_000);
  avisar('');
  if (!segunda) throw new Error(FRASE_ACORDANDO);
  return segunda;
}

function servidorLento(resposta: Response): boolean {
  return resposta.status === 502 || resposta.status === 503 || resposta.status === 504;
}

async function tentar(
  entrada: string,
  init: RequestInit | undefined,
  prazoMs: number,
): Promise<Response | null> {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), prazoMs);
  try {
    return await fetch(entrada, { ...init, signal: controle.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, ms));
}
