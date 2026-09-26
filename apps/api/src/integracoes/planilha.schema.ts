import { Schema } from 'mongoose';

export const planilhaLinhaSchema = new Schema(
  {
    hash: { type: String, required: true, unique: true },
    linha: { type: Number, required: true },
    em: { type: Date, required: true },
  },
  { collection: 'planilha_linhas', versionKey: false },
);

export const planilhaMarcaSchema = new Schema(
  {
    planilhaId: { type: String, required: true, unique: true },
    ultimaLinha: { type: Number, required: true },
    em: { type: Date, required: true },
  },
  { collection: 'planilha_marcas', versionKey: false },
);
