let profundidadeAtual = 0;

export function profundidadeFila(): number {
  return profundidadeAtual;
}

/**
 * A fila offline ainda não existe (chega na Fase 1). O gancho já distingue
 * crescimento: fila que só aumenta é dado acumulado sem destino.
 */
export function registrarProfundidadeFila(profundidade: number): void {
  if (profundidade > profundidadeAtual && profundidade > 0) {
    console.warn(
      JSON.stringify({
        nivel: 'WARN',
        evento: 'fila_sincronizacao_crescendo',
        profundidade,
        em: new Date().toISOString(),
      }),
    );
  }
  profundidadeAtual = profundidade;
}
