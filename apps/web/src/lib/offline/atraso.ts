const TETO_MS = 5 * 60 * 1000;

export function atrasoMs(tentativa: number): number {
  const forçado = (globalThis as { __CAPTURA7_BACKOFF_MS?: number }).__CAPTURA7_BACKOFF_MS;
  if (typeof forçado === 'number') return forçado;
  const expoente = Math.max(tentativa - 1, 0);
  return Math.min(1000 * 2 ** expoente, TETO_MS);
}
