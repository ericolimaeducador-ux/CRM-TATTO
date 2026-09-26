export const PRAZO_PURGA_REVOGACAO_DIAS = 30;
export const PRAZO_SINALIZAR_RASCUNHO_DIAS = 180;

export const CAMPOS_PURGADOS_NA_REVOGACAO = ['emails', 'telefones', 'enderecos'] as const;

const DIA_MS = 24 * 60 * 60 * 1000;

export function exportacaoBloqueada(revogadoEm?: Date | null): boolean {
  return revogadoEm != null;
}

export interface LgpdMinimo {
  baseLegal?: string;
  contatoComercial?: string;
  revogadoEm?: Date | null;
  eliminadoEm?: Date | null;
  consentimentos?: { finalidade?: string; revogadoEm?: Date | null }[];
}

export function mesesDeRetencao(): number {
  const bruto = Number(process.env.RETENCAO_MESES ?? 24);
  if (!Number.isInteger(bruto) || bruto < 1 || bruto > 120) return 24;
  return bruto;
}

export function importadoLiberado(lgpd?: LgpdMinimo | null, modo?: string): boolean {
  if (!lgpd || lgpd.revogadoEm || lgpd.eliminadoEm) return false;
  return modo === 'importado' && lgpd.baseLegal === 'legitimo_interesse';
}

export function deveExpirarPorInatividade(
  alteradoEm: Date | undefined,
  agora: Date,
  meses = mesesDeRetencao(),
): boolean {
  if (!alteradoEm) return false;
  const limite = new Date(alteradoEm);
  limite.setMonth(limite.getMonth() + meses);
  return agora.getTime() >= limite.getTime();
}

export function contatoComercialLiberado(lgpd?: LgpdMinimo | null): boolean {
  if (!lgpd || lgpd.revogadoEm || lgpd.eliminadoEm) return false;
  return lgpd.contatoComercial === 'concedido';
}

export function envioErpLiberado(lgpd?: LgpdMinimo | null): boolean {
  if (!lgpd || lgpd.revogadoEm || lgpd.eliminadoEm) return false;
  return (lgpd.consentimentos ?? []).some(
    (item) => item.finalidade === 'envio_erp' && item.revogadoEm == null,
  );
}

export function exportacaoDaFinalidadeBloqueada(
  lgpd: LgpdMinimo | null | undefined,
  finalidade: 'contato_comercial' | 'envio_erp',
): boolean {
  if (finalidade === 'envio_erp') return !envioErpLiberado(lgpd);
  return !contatoComercialLiberado(lgpd);
}

export function prazoGuardaAuditoriaDias(): number | null {
  const bruto = process.env.AUDITORIA_PRAZO_GUARDA_DIAS;
  if (bruto == null || bruto.trim() === '') return null;
  const numero = Number(bruto);
  if (!Number.isInteger(numero) || numero < 1) return null;
  return numero;
}

export function aplicarGuardaAuditoria(): { apagadas: 0; motivo: string } {
  if (prazoGuardaAuditoriaDias() == null) return { apagadas: 0, motivo: 'prazo_ausente' };
  return { apagadas: 0, motivo: 'trilha_imutavel' };
}

export function diasDePurgaRevogacao(): number {
  return inteiroDeAmbiente('PURGA_REVOGACAO_DIAS', PRAZO_PURGA_REVOGACAO_DIAS);
}

export function diasDeRascunho(): number {
  return inteiroDeAmbiente('RASCUNHO_DIAS', PRAZO_SINALIZAR_RASCUNHO_DIAS);
}

export function devePurgarContato(revogadoEm: Date | undefined, agora: Date): boolean {
  if (!revogadoEm) return false;
  return agora.getTime() >= revogadoEm.getTime() + diasDePurgaRevogacao() * DIA_MS;
}

export function deveSinalizarRascunho(
  status: string,
  alteradoEm: Date | undefined,
  agora: Date,
): boolean {
  if (status !== 'rascunho' || !alteradoEm) return false;
  return agora.getTime() >= alteradoEm.getTime() + diasDeRascunho() * DIA_MS;
}

function inteiroDeAmbiente(nome: string, padrao: number): number {
  const bruto = process.env[nome];
  if (bruto == null || bruto.trim() === '') return padrao;
  const numero = Number(bruto);
  if (!Number.isInteger(numero) || numero < 1 || numero > 3650) return padrao;
  return numero;
}
