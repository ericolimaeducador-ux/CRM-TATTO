import { Types, type Model } from 'mongoose';
import type { ContatoAuditoria } from './schemas/contato-auditoria.schema';

const CAMPOS = [
  'nome',
  'nomeSocial',
  'status',
  'observacoes',
  'tipoPessoa',
  'emails',
  'telefones',
  'enderecos',
  'pf',
  'pj',
  'motivoDescarte',
  'completude',
] as const;

export async function gravarAuditoriaHttp(
  modelo: Model<ContatoAuditoria>,
  antes: Record<string, unknown> | null,
  depois: Record<string, unknown> | null,
  autorId: string,
  autorNome: string,
): Promise<void> {
  if (!antes || !depois || antes.status === 'rascunho') return;
  const diffs = CAMPOS.filter(
    (campo) => JSON.stringify(antes[campo] ?? null) !== JSON.stringify(depois[campo] ?? null),
  ).map((campo) => ({
    contatoId: depois._id,
    versao: depois.versao,
    campo,
    valorAnterior: antes[campo] ?? null,
    valorNovo: depois[campo] ?? null,
    autor: new Types.ObjectId(autorId),
    autorNome,
    timestampServidor: new Date(),
    origem: 'api' as const,
  }));
  if (diffs.length === 0) return;
  await modelo.insertMany(diffs);
}
