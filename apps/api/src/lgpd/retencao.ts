export const PRAZO_PURGA_REVOGACAO_DIAS = 30;
export const PRAZO_SINALIZAR_RASCUNHO_DIAS = 180;

export const CAMPOS_PURGADOS_NA_REVOGACAO = ['emails', 'telefones', 'enderecos'] as const;

const DIA_MS = 24 * 60 * 60 * 1000;

export function exportacaoBloqueada(revogadoEm?: Date | null): boolean {
  return revogadoEm != null;
}

export function devePurgarContato(revogadoEm: Date | undefined, agora: Date): boolean {
  if (!revogadoEm) return false;
  return agora.getTime() >= revogadoEm.getTime() + PRAZO_PURGA_REVOGACAO_DIAS * DIA_MS;
}

export function deveSinalizarRascunho(
  status: string,
  alteradoEm: Date | undefined,
  agora: Date,
): boolean {
  if (status !== 'rascunho' || !alteradoEm) return false;
  return agora.getTime() >= alteradoEm.getTime() + PRAZO_SINALIZAR_RASCUNHO_DIAS * DIA_MS;
}
