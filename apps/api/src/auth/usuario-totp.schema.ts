import { Schema } from 'mongoose';

export const usuarioTotpSchema = new Schema(
  {
    usuarioId: { type: String, required: true, unique: true },
    segredoCifrado: { type: String, required: true },
    ultimoPassoAceito: { type: Number, default: null },
  },
  { collection: 'usuarios_totp', strict: true, versionKey: false },
);
