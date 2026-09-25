import type { Connection, Model } from 'mongoose';
import { contadorSchema } from './contador.schema';
import { contatoAuditoriaSchema, type ContatoAuditoria } from './contato-auditoria.schema';
import { contatoSchema, type Contato } from './contato.schema';

export interface ModelosContato {
  Contato: Model<Contato>;
  ContatoAuditoria: Model<ContatoAuditoria>;
}

export function registrarModelos(conexao: Connection): ModelosContato {
  if (!conexao.models.Contador) conexao.model('Contador', contadorSchema);
  const Contato =
    (conexao.models.Contato as Model<Contato> | undefined) ??
    conexao.model<Contato>('Contato', contatoSchema);
  const ContatoAuditoria =
    (conexao.models.ContatoAuditoria as Model<ContatoAuditoria> | undefined) ??
    conexao.model<ContatoAuditoria>('ContatoAuditoria', contatoAuditoriaSchema);
  return { Contato, ContatoAuditoria };
}

export async function garantirIndices(conexao: Connection): Promise<void> {
  const modelos = registrarModelos(conexao);
  await modelos.Contato.createIndexes();
  await modelos.ContatoAuditoria.createIndexes();
}
