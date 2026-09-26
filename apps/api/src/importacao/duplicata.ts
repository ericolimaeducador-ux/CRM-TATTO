import type { Model } from 'mongoose';
import { apenasDigitos, cnpjValido, cpfValido } from '../normalizacao/documento';
import { normalizarEmail, normalizarNome, normalizarTelefone } from '../normalizacao/normalizar';
import { hmacDocumento } from '../seguranca/cifra';

export async function duplicataDeCampos(
  contatos: Model<unknown>,
  campos: {
    email?: string;
    telefone?: string;
    cpf?: string;
    cnpj?: string;
    nome?: string;
    razaoSocial?: string;
  },
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
  const cpf = hashSeValido(campos.cpf, cpfValido);
  if (cpf) consultas.push({ 'pf.cpfHash': cpf });
  const cnpj = hashSeValido(campos.cnpj, cnpjValido);
  if (cnpj) consultas.push({ 'pj.cnpjHash': cnpj });
  if (consultas.length > 0) return existe(contatos, { $or: consultas });
  return duplicataPorNome(contatos, campos.nome, campos.razaoSocial);
}

async function duplicataPorNome(
  contatos: Model<unknown>,
  nomeBruto: string | undefined,
  empresa: string | undefined,
): Promise<boolean> {
  if (!nomeBruto?.trim()) return false;
  const nome = normalizarNome(nomeBruto);
  if (!nome.trim()) return false;
  const empresaNorm = empresa?.trim() ? normalizarNome(empresa) : '';
  const filtroEmpresa = empresaNorm
    ? { 'pj.razaoSocial': empresaNorm }
    : { $or: [{ 'pj.razaoSocial': null }, { 'pj.razaoSocial': '' }] };
  return existe(contatos, { $and: [{ nome }, filtroEmpresa] });
}

function hashSeValido(valor: string | undefined, valido: (entrada: string) => boolean): string {
  if (!valor || !valido(valor)) return '';
  return hmacDocumento(apenasDigitos(valor));
}

async function existe(contatos: Model<unknown>, filtro: Record<string, unknown>): Promise<boolean> {
  const ja = await contatos.exists({
    $and: [
      filtro,
      { $or: [{ 'lgpd.eliminadoEm': { $exists: false } }, { 'lgpd.eliminadoEm': null }] },
    ],
  });
  return Boolean(ja);
}
