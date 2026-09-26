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
