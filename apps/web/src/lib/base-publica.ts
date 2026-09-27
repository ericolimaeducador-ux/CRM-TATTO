export function basenameDe(base = import.meta.env.BASE_URL): string | undefined {
  if (!base || base === '/') return undefined;
  return base.replace(/\/$/, '');
}

export function urlDoAplicativo(
  caminho: string,
  base = import.meta.env.BASE_URL || '/',
  origem = window.location.origin,
): string {
  const prefixo = base.endsWith('/') ? base : `${base}/`;
  const relativo = caminho.replace(/^\//, '');
  return new URL(relativo, `${origem}${prefixo}`).toString();
}

export function hospedagemPublica(host = window.location.hostname): boolean {
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return false;
  if (host.startsWith('10.') || host.startsWith('192.168.')) return false;
  return !/^172\.(1[6-9]|2\d|3[0-1])\./.test(host);
}
