import type { IndexDefinition, IndexOptions, Schema } from 'mongoose';

export interface IndiceDeclarado {
  colecao: 'contatos' | 'contatos_auditoria';
  campos: IndexDefinition;
  opcoes: IndexOptions & { name: string };
}

// MongoDB 7 recusa $nin/$not em partialFilterExpression (ADR-007).
// No enum fechado de status, isto é o mesmo que excluir rascunho e descartado.
const statusForaDeRascunhoEDescarte = { $in: ['capturado', 'qualificado', 'cliente'] };

export const INDICES: IndiceDeclarado[] = [
  {
    colecao: 'contatos',
    campos: { 'pf.cpfHash': 1 },
    opcoes: {
      unique: true,
      name: 'uniq_pf_cpfHash_nao_rascunho',
      background: true,
      partialFilterExpression: {
        status: statusForaDeRascunhoEDescarte,
        'pf.cpfHash': { $exists: true },
      },
    },
  },
  {
    colecao: 'contatos',
    campos: { 'pj.cnpjHash': 1 },
    opcoes: {
      unique: true,
      name: 'uniq_pj_cnpjHash_nao_rascunho',
      background: true,
      partialFilterExpression: {
        status: statusForaDeRascunhoEDescarte,
        'pj.cnpjHash': { $exists: true },
      },
    },
  },
  {
    colecao: 'contatos',
    campos: { idLocal: 1 },
    opcoes: { unique: true, name: 'uniq_idLocal', background: true },
  },
  {
    colecao: 'contatos',
    campos: { 'emails.valor': 1 },
    opcoes: { name: 'idx_emails_valor', background: true },
  },
  {
    colecao: 'contatos',
    campos: { 'telefones.e164': 1 },
    opcoes: { name: 'idx_telefones_e164', background: true },
  },
  {
    colecao: 'contatos',
    campos: { 'pj.cnpjRaiz': 1 },
    opcoes: { name: 'idx_pj_cnpjRaiz', background: true },
  },
  {
    colecao: 'contatos',
    campos: { status: 1, criadoEm: -1 },
    opcoes: { name: 'idx_status_criadoEm', background: true },
  },
  {
    colecao: 'contatos',
    campos: { 'origem.vendedorAtribuido': 1, criadoEm: -1 },
    opcoes: { name: 'idx_vendedor_criadoEm', background: true },
  },
  {
    colecao: 'contatos',
    campos: { codigo: 1 },
    opcoes: { unique: true, name: 'uniq_codigo', background: true },
  },
  {
    colecao: 'contatos',
    campos: { nome: 'text', 'pj.razaoSocial': 'text', 'pj.nomeFantasia': 'text' },
    opcoes: { name: 'txt_nome_razao_fantasia', default_language: 'portuguese', background: true },
  },
  {
    colecao: 'contatos_auditoria',
    campos: { contatoId: 1, timestampServidor: -1 },
    opcoes: { name: 'idx_aud_contato_tempo', background: true },
  },
  {
    colecao: 'contatos_auditoria',
    campos: { autor: 1, timestampServidor: -1 },
    opcoes: { name: 'idx_aud_autor_tempo', background: true },
  },
];

export function aplicarIndices(schema: Schema, colecao: IndiceDeclarado['colecao']): void {
  for (const indice of INDICES) {
    if (indice.colecao !== colecao) continue;
    schema.index(indice.campos, indice.opcoes);
  }
}
