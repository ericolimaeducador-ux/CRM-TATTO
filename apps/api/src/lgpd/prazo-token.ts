const PADRAO_TTL_SEGUNDOS = 2 * 60 * 60;

export function prazoTokenSegundos(): number {
  return inteiroDeAmbiente('QR_TOKEN_TTL_SEGUNDOS', PADRAO_TTL_SEGUNDOS, 60, 24 * 60 * 60);
}

export function limiteDeUsosDoToken(): number {
  return inteiroDeAmbiente('QR_TOKEN_MAX_USOS', 1, 1, 20);
}

function inteiroDeAmbiente(nome: string, padrao: number, minimo: number, maximo: number): number {
  const bruto = process.env[nome];
  if (!bruto) return padrao;
  if (!/^[1-9]\d*$/.test(bruto)) {
    throw new Error(`${nome} precisa ser um inteiro positivo.`);
  }
  const valor = Number(bruto);
  if (valor < minimo || valor > maximo) {
    throw new Error(`${nome} precisa ficar entre ${minimo} e ${maximo}.`);
  }
  return valor;
}
