import { Schema } from 'mongoose';

export const tokenAutocadastroSchema = new Schema(
  {
    token: { type: String, required: true, unique: true },
    vendedorId: { type: Schema.Types.ObjectId, required: true },
    criadoEm: { type: Date, required: true },
  },
  { collection: 'tokens_autocadastro', versionKey: false },
);
