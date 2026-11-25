import { Schema } from 'mongoose';

export const tokenAtualizacaoCadastroSchema = new Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    contatoId: { type: Schema.Types.ObjectId, required: true, index: true },
    emitidoPor: { type: Schema.Types.ObjectId, required: true },
    criadoEm: { type: Date, required: true },
    expiraEm: { type: Date, required: true, index: true },
    usadoEm: { type: Date, default: null },
  },
  { collection: 'tokens_atualizacao_cadastro', versionKey: false },
);
