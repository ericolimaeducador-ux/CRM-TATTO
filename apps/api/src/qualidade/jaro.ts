export function jaroWinkler(esquerda: string, direita: string): number {
  if (esquerda === direita) return 1;
  if (!esquerda.length || !direita.length) return 0;
  const distancia = Math.max(Math.floor(Math.max(esquerda.length, direita.length) / 2) - 1, 0);
  const marcaEsquerda = new Array<boolean>(esquerda.length).fill(false);
  const marcaDireita = new Array<boolean>(direita.length).fill(false);
  let casamentos = 0;
  for (let i = 0; i < esquerda.length; i += 1) {
    const inicio = Math.max(0, i - distancia);
    const fim = Math.min(i + distancia + 1, direita.length);
    for (let j = inicio; j < fim; j += 1) {
      if (marcaDireita[j] || esquerda[i] !== direita[j]) continue;
      marcaEsquerda[i] = true;
      marcaDireita[j] = true;
      casamentos += 1;
      break;
    }
  }
  if (casamentos === 0) return 0;
  let transposicoes = 0;
  let cursor = 0;
  for (let i = 0; i < esquerda.length; i += 1) {
    if (!marcaEsquerda[i]) continue;
    while (!marcaDireita[cursor]) cursor += 1;
    if (esquerda[i] !== direita[cursor]) transposicoes += 1;
    cursor += 1;
  }
  const jaro =
    (casamentos / esquerda.length +
      casamentos / direita.length +
      (casamentos - transposicoes / 2) / casamentos) /
    3;
  let prefixo = 0;
  const limite = Math.min(4, esquerda.length, direita.length);
  for (let i = 0; i < limite; i += 1) {
    if (esquerda[i] !== direita[i]) break;
    prefixo += 1;
  }
  return jaro + prefixo * 0.1 * (1 - jaro);
}
