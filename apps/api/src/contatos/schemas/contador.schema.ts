import { Schema } from 'mongoose';

export const contadorSchema = new Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { collection: 'contadores', versionKey: false },
);
