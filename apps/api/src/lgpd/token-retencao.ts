import { createHash, timingSafeEqual } from 'node:crypto';

export const CABECALHO_RETENCAO = 'x-retencao-token';

export function tokenConfere(recebido: string | undefined, esperado: string | undefined): boolean {
  const certo = (esperado ?? '').trim();
  if (certo.length < 32) return false;
  const a = createHash('sha256')
    .update(recebido ?? '', 'utf8')
    .digest();
  const b = createHash('sha256').update(certo, 'utf8').digest();
  return timingSafeEqual(a, b);
}
