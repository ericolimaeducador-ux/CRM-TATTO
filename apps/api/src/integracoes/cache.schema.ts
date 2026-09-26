import { Schema } from 'mongoose';

export const cacheEnriquecimentoSchema = new Schema(
  {
    chave: { type: String, required: true, unique: true },
    fonte: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    expiraEm: { type: Date },
  },
  { collection: 'enriquecimento_cache', versionKey: false },
);
