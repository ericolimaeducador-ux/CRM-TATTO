import { hmacDocumento } from '../../seguranca/cifra';

const RAIZES_PESSOAIS = new Set([
  'nome',
  'nomeSocial',
  'observacoes',
  'emails',
  'telefones',
  'enderecos',
  'pf',
  'pj',
  'motivoDescarte',
]);

export function pseudonimizarCampo(campo: string, valor: unknown): unknown {
  if (valor == null) return null;
  if (!RAIZES_PESSOAIS.has(campo.split('.')[0] ?? '')) return valor;
  const texto = typeof valor === 'string' ? valor : JSON.stringify(valor);
  return hmacDocumento(texto);
}

export function pseudonimizarAutor(nome: string): string {
  return hmacDocumento(nome);
}
