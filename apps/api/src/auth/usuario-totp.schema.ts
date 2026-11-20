import { Schema } from 'mongoose';

export const usuarioTotpSchema = new Schema(
  {
    usuarioId: { type: String, required: true, unique: true },
    segredoCifrado: { type: String },
    segredoPendenteCifrado: { type: String },
    ultimoPassoAceito: { type: Number, default: null },
  },
  { collection: 'usuarios_totp', strict: true, versionKey: false },
);
