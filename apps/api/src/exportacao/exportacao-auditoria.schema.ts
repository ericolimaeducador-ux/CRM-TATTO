import { Schema } from 'mongoose';

export const exportacaoAuditoriaSchema = new Schema(
  {
    autorId: { type: String, required: true },
    papel: { type: String, required: true },
    formato: { type: String, required: true },
    filtros: { type: Schema.Types.Mixed, required: true },
    quantidade: { type: Number, required: true },
    em: { type: Date, required: true },
  },
  { collection: 'auditoria_exportacao', strict: true, versionKey: false },
);
