import { Schema } from 'mongoose';

export const webhookSaidaSchema = new Schema(
  {
    chaveIdempotencia: { type: String, required: true, unique: true },
    contatoId: { type: String, required: true },
    versao: { type: Number, required: true },
    autorId: { type: String, required: true },
    hashCorpo: { type: String, required: true },
    corpoJson: { type: String, required: true },
    status: { type: String, required: true },
    tentativas: { type: Number, default: 0 },
    ultimoErro: { type: String, default: '' },
    criadoEm: { type: Date, required: true },
    entregueEm: { type: Date },
  },
  { collection: 'webhooks_saida', strict: true, versionKey: false },
);
