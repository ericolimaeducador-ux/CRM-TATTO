import { Schema } from 'mongoose';

export const tokenAutocadastroSchema = new Schema(
  {
    token: { type: String, required: true, unique: true },
    vendedorId: { type: Schema.Types.ObjectId, required: true },
    criadoEm: { type: Date, required: true },
    expiraEm: { type: Date, required: true },
    usos: { type: Number, required: true, default: 0 },
    limiteUsos: { type: Number, required: true },
    revogadoEm: { type: Date, default: null },
  },
  { collection: 'tokens_autocadastro', versionKey: false },
);
