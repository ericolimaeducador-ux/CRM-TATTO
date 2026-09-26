import type { Model } from 'mongoose';
import { normalizarEmail, normalizarTelefone } from '../normalizacao/normalizar';

export async function duplicataDeCampos(
  contatos: Model<unknown>,
  campos: { email?: string; telefone?: string },
): Promise<boolean> {
  const consultas: Record<string, string>[] = [];
  if (campos.email) {
    const email = normalizarEmail(campos.email);
    if (email.valor.includes('@')) consultas.push({ 'emails.valor': email.valor });
  }
  if (campos.telefone) {
    const telefone = normalizarTelefone(campos.telefone);
    if (telefone.e164) consultas.push({ 'telefones.e164': telefone.e164 });
  }
  if (consultas.length === 0) return false;
  const ja = await contatos.exists({
    $and: [
      { $or: consultas },
      { $or: [{ 'lgpd.eliminadoEm': { $exists: false } }, { 'lgpd.eliminadoEm': null }] },
    ],
  });
  return Boolean(ja);
}
