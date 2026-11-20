import { Schema, Types } from 'mongoose';

export const ESTADOS_WHATSAPP = [
  'aguardando',
  'pendente',
  'processando',
  'aceito',
  'enviado',
  'entregue',
  'lido',
  'falha',
  'incerto',
  'cancelado',
  'expirado',
] as const;
export type EstadoWhatsApp = (typeof ESTADOS_WHATSAPP)[number];

export interface TrabalhoWhatsApp {
  _id: Types.ObjectId;
  chave: string;
  contatoId: Types.ObjectId;
  estado: EstadoWhatsApp;
  motivo: string;
  tentativas: number;
  criadoEm: Date;
  expiraEm: Date;
  proximaTentativaEm: Date;
  reservaAte?: Date;
  reservaId?: string;
  mensagemId?: string;
  telefoneHash?: string;
  template?: string;
  idioma?: string;
  atualizadoEm: Date;
  nivelRecibo?: number;
  eventos: { estado: string; em: Date; codigo?: string }[];
}

export const trabalhoWhatsAppSchema = new Schema<TrabalhoWhatsApp>(
  {
    chave: { type: String, required: true },
    contatoId: { type: Schema.Types.ObjectId, required: true },
    estado: { type: String, enum: ESTADOS_WHATSAPP, required: true },
    motivo: { type: String, default: '' },
    tentativas: { type: Number, default: 0 },
    criadoEm: { type: Date, required: true },
    expiraEm: { type: Date, required: true },
    proximaTentativaEm: { type: Date, required: true },
    reservaAte: Date,
    reservaId: String,
    mensagemId: String,
    telefoneHash: String,
    template: String,
    idioma: String,
    atualizadoEm: { type: Date, required: true },
    nivelRecibo: { type: Number, default: 0 },
    eventos: { type: [{ _id: false, estado: String, em: Date, codigo: String }], default: [] },
  },
  { collection: 'whatsapp_fila', versionKey: false },
);
trabalhoWhatsAppSchema.index({ chave: 1 }, { unique: true });
trabalhoWhatsAppSchema.index({ contatoId: 1 }, { unique: true });
trabalhoWhatsAppSchema.index({ estado: 1, proximaTentativaEm: 1, expiraEm: 1 });
trabalhoWhatsAppSchema.index({ mensagemId: 1 }, { unique: true, sparse: true });

export interface ControleWhatsApp {
  _id: string;
  instaladoEm: Date;
}
export const controleWhatsAppSchema = new Schema<ControleWhatsApp>(
  {
    _id: String,
    instaladoEm: { type: Date, required: true },
  },
  { collection: 'whatsapp_controle', versionKey: false },
);

export interface BloqueioWhatsApp {
  telefoneHash: string;
  em: Date;
}
export const bloqueioWhatsAppSchema = new Schema<BloqueioWhatsApp>(
  {
    telefoneHash: { type: String, required: true },
    em: { type: Date, required: true },
  },
  { collection: 'whatsapp_bloqueios', versionKey: false },
);
bloqueioWhatsAppSchema.index({ telefoneHash: 1 }, { unique: true });

export interface ReciboWhatsApp {
  mensagemId: string;
  enviado?: boolean;
  entregue?: boolean;
  lido?: boolean;
  falhou?: boolean;
  codigo?: string;
  atualizadoEm: Date;
}
export const reciboWhatsAppSchema = new Schema<ReciboWhatsApp>(
  {
    mensagemId: { type: String, required: true },
    enviado: Boolean,
    entregue: Boolean,
    lido: Boolean,
    falhou: Boolean,
    codigo: String,
    atualizadoEm: { type: Date, required: true },
  },
  { collection: 'whatsapp_recibos', versionKey: false },
);
reciboWhatsAppSchema.index({ mensagemId: 1 }, { unique: true });
reciboWhatsAppSchema.index({ atualizadoEm: 1 }, { expireAfterSeconds: 30 * 86_400 });
