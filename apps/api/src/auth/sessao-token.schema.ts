import { Schema } from 'mongoose';

export const sessaoTokenSchema = new Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    usuarioId: { type: String, required: true },
    papel: { type: String, required: true },
    nome: { type: String, required: true },
    expiraEm: { type: Date, required: true },
    stepUpAte: { type: Date, default: null },
  },
  { collection: 'sessoes', strict: true, versionKey: false },
);
