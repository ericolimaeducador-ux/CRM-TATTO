const JANELA_MS = 60_000;
const pedidos = new Map<string, number[]>();

export function zerarPedidosPublicos(): void {
  pedidos.clear();
}

export function classificarPedido(ip: string, agora = Date.now()): 'ok' | 'captcha' | 'limite' {
  const lista = (pedidos.get(ip) ?? []).filter((item) => item >= agora - JANELA_MS);
  lista.push(agora);
  pedidos.set(ip, lista);
  if (lista.length > 10) return 'limite';
  if (lista.length > 3) return 'captcha';
  return 'ok';
}
