const JANELA_MS = 60_000;
const pedidos = new Map<string, number[]>();

export function zerarPedidosPublicos(): void {
  pedidos.clear();
}

export function chavesPedidosPublicos(): string[] {
  return [...pedidos.keys()];
}

export function classificarPedido(ip: string, agora = Date.now()): 'ok' | 'captcha' | 'limite' {
  const corte = agora - JANELA_MS;
  for (const [chave, marcas] of pedidos) {
    const vivos = marcas.filter((item) => item >= corte);
    if (vivos.length === 0) pedidos.delete(chave);
    else if (vivos.length !== marcas.length) pedidos.set(chave, vivos);
  }
  const lista = pedidos.get(ip) ?? [];
  lista.push(agora);
  pedidos.set(ip, lista);
  if (lista.length > 10) return 'limite';
  if (lista.length > 3) return 'captcha';
  return 'ok';
}
