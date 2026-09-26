import { Schema, type Types } from 'mongoose';
import { AuditoriaImutavel } from './erro-nomeado';
import { aplicarIndices } from './indices';

export const ORIGENS_AUDITORIA = ['api', 'sync', 'enriquecimento', 'merge', 'rotina'] as const;
export type OrigemAuditoria = (typeof ORIGENS_AUDITORIA)[number];

export interface ContatoAuditoria {
  contatoId: Types.ObjectId;
  versao: number;
  campo: string;
  valorAnterior: unknown;
  valorNovo: unknown;
  autor: Types.ObjectId;
  autorNome: string;
  timestampServidor: Date;
  motivo?: string;
  origem: OrigemAuditoria;
}

const OPERACOES_PROIBIDAS = [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'replaceOne',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
] as const;

export const contatoAuditoriaSchema = new Schema<ContatoAuditoria>(
  {
    contatoId: { type: Schema.Types.ObjectId, required: true },
    versao: { type: Number, required: true },
    campo: { type: String, required: true },
    valorAnterior: { type: Schema.Types.Mixed },
    valorNovo: { type: Schema.Types.Mixed },
    autor: { type: Schema.Types.ObjectId, required: true },
    autorNome: { type: String, required: true },
    timestampServidor: { type: Date, required: true },
    motivo: { type: String },
    origem: { type: String, required: true, enum: ORIGENS_AUDITORIA },
  },
  { collection: 'contatos_auditoria', versionKey: false },
);

for (const operacao of OPERACOES_PROIBIDAS) {
  contatoAuditoriaSchema.pre(
    operacao,
    { document: false, query: true },
    function bloquearConsulta() {
      throw new AuditoriaImutavel();
    },
  );
  contatoAuditoriaSchema.pre(
    operacao,
    { document: true, query: false },
    function bloquearDocumento() {
      throw new AuditoriaImutavel();
    },
  );
}

aplicarIndices(contatoAuditoriaSchema, 'contatos_auditoria');
