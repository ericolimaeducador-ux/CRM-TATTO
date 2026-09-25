import type { Schema } from 'mongoose';
import { baseLegalPorModo } from '../lgpd/base-legal';
import { cifrar, hmacDocumento, mascararCnpj, mascararCpf } from './cifra';

const esquemas = new WeakSet<Schema>();

interface DocumentoSeguro {
  get(caminho: string): unknown;
  set(caminho: string, valor: unknown): unknown;
  isModified(caminho: string): boolean;
  $locals: {
    cpfPuro?: string;
    cnpjPuro?: string;
    baseLegalExplicita?: boolean;
  };
}

export function aplicarSegurancaNoSchema(schema: Schema): void {
  if (esquemas.has(schema)) return;
  esquemas.add(schema);
  schema.pre('validate', function proteger() {
    const doc = this as unknown as DocumentoSeguro;
    gravarDocumento(doc, 'cpf');
    gravarDocumento(doc, 'cnpj');
    if (doc.$locals.baseLegalExplicita === true || doc.isModified('lgpd.baseLegal')) return;
    const modo =
      typeof doc.get('origem.modo') === 'string' ? String(doc.get('origem.modo')) : 'manual';
    const derivada = baseLegalPorModo(modo);
    doc.set('lgpd.baseLegal', derivada.baseLegal);
    doc.set('lgpd.finalidade', derivada.finalidade);
    doc.set('lgpd.canalColeta', derivada.canalColeta);
  });
}

function gravarDocumento(doc: DocumentoSeguro, tipo: 'cpf' | 'cnpj'): void {
  const puro = tipo === 'cpf' ? doc.$locals.cpfPuro : doc.$locals.cnpjPuro;
  if (typeof puro !== 'string' || puro.length === 0) return;
  const digitos = puro.replace(/\D/g, '');
  const valor = digitos.length > 0 ? digitos : puro;
  const prefixo = tipo === 'cpf' ? 'pf.cpf' : 'pj.cnpj';
  doc.set(`${prefixo}Cifrado`, cifrar(valor));
  const tamanho = tipo === 'cpf' ? 11 : 14;
  if (digitos.length === tamanho) {
    doc.set(`${prefixo}Hash`, hmacDocumento(digitos));
    doc.set(`${prefixo}Mascarado`, tipo === 'cpf' ? mascararCpf(digitos) : mascararCnpj(digitos));
    if (tipo === 'cnpj') doc.set('pj.cnpjRaiz', digitos.slice(0, 8));
  }
  if (tipo === 'cpf') delete doc.$locals.cpfPuro;
  else delete doc.$locals.cnpjPuro;
}
