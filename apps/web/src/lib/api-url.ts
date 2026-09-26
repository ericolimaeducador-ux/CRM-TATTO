export function urlDaApi(caminho: string): string {
  const base = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
  const sufixo = caminho.startsWith('/') ? caminho : `/${caminho}`;
  return `${base}${sufixo}`;
}
