import { Schema } from 'mongoose';

export const authAuditoriaSchema = new Schema(
  {
    evento: { type: String, required: true },
    usuarioId: { type: String, required: true },
    porUsuarioId: { type: String },
    em: { type: Date, required: true },
  },
  { collection: 'auth_auditoria', strict: true, versionKey: false },
);
