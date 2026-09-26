const LIMIAR = 5;
const JANELA_MS = 60_000;

interface Estado {
  falhas: number;
  abertoAte: number;
}

const circuitos = new Map<string, Estado>();

export function circuitoAberto(fonte: string, agora = Date.now()): boolean {
  const estado = circuitos.get(fonte);
  if (!estado?.abertoAte) return false;
  if (estado.abertoAte > agora) return true;
  estado.falhas = LIMIAR - 1;
  estado.abertoAte = 0;
  return false;
}

export function registrarResultado(fonte: string, sucesso: boolean, agora = Date.now()): void {
  if (sucesso) {
    circuitos.set(fonte, { falhas: 0, abertoAte: 0 });
    return;
  }
  const estado = circuitos.get(fonte) ?? { falhas: 0, abertoAte: 0 };
  estado.falhas += 1;
  if (estado.falhas >= LIMIAR) estado.abertoAte = agora + JANELA_MS;
  circuitos.set(fonte, estado);
}

export function zerarCircuitos(): void {
  circuitos.clear();
}
