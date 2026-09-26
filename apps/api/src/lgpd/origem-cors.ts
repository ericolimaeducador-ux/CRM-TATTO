export function origemPermitida(origem: string | undefined): boolean {
  if (origemDeRedeLocal(origem)) return true;
  if (!origem) return false;
  const extras = (process.env.CORS_ORIGENS ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return extras.includes(origem);
}

export function origemDeRedeLocal(origem: string | undefined): boolean {
  if (!origem) return true;
  let url: URL;
  try {
    url = new URL(origem);
  } catch {
    return false;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  const host = url.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;
  if (host.startsWith('10.') || host.startsWith('192.168.')) return true;
  return /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);
}
