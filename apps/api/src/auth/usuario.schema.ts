import { Schema } from 'mongoose';

export const usuarioSchema = new Schema(
  {
    login: { type: String, required: true, unique: true },
    senhaHash: { type: String, required: true },
    nome: { type: String, required: true },
    papel: { type: String, enum: ['vendedor', 'gestor', 'admin', 'auditor'], required: true },
    ativo: { type: Boolean, default: true },
    trocarSenhaObrigatoria: { type: Boolean, default: false },
    criadoEm: { type: Date, required: true },
  },
  { collection: 'usuarios', strict: true, versionKey: false },
);
