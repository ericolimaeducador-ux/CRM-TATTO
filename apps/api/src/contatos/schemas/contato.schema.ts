import { Schema, type Types } from 'mongoose';
import { aplicarIndices } from './indices';
import { aplicarIntegridade } from './integridade.plugin';
import {
  emailSchema,
  enderecoSchema,
  lgpdSchema,
  origemSchema,
  pfSchema,
  pjSchema,
  telefoneSchema,
} from './contato.subdocumentos';

export const TIPOS_PESSOA = ['PF', 'PJ', 'INDEFINIDO'] as const;
export const STATUS_CONTATO = [
  'rascunho',
  'capturado',
  'qualificado',
  'cliente',
  'descartado',
] as const;

export type TipoPessoa = (typeof TIPOS_PESSOA)[number];
export type StatusContato = (typeof STATUS_CONTATO)[number];

export interface Contato {
  codigo?: string;
  idLocal?: string;
  tipoPessoa: TipoPessoa;
  status: StatusContato;
  motivoDescarte?: string;
  nome?: string;
  nomeSocial?: string;
  emails?: { valor?: string; tipo?: 'pessoal' | 'comercial'; principal?: boolean }[];
  telefones?: {
    e164?: string;
    bruto?: string;
    tipo?: 'celular' | 'fixo' | 'comercial';
    whatsapp?: boolean;
    principal?: boolean;
  }[];
  pf?: { cpfCifrado?: string; cpfHash?: string; cpfMascarado?: string };
  pj?: {
    cnpjCifrado?: string;
    cnpjHash?: string;
    cnpjMascarado?: string;
    cnpjRaiz?: string;
    razaoSocial?: string;
  };
  lgpd: { baseLegal: string; finalidade: string[]; canalColeta: string };
  criadoPor?: Types.ObjectId;
  criadoEm?: Date;
  alteradoPor?: Types.ObjectId;
  alteradoEm?: Date;
  versao: number;
}

export const contatoSchema = new Schema(
  {
    codigo: { type: String },
    idLocal: { type: String },
    tipoPessoa: { type: String, enum: TIPOS_PESSOA, default: 'INDEFINIDO' },
    status: { type: String, enum: STATUS_CONTATO, default: 'rascunho' },
    motivoDescarte: { type: String },
    nome: { type: String },
    nomeSocial: { type: String },
    emails: { type: [emailSchema] },
    telefones: { type: [telefoneSchema] },
    enderecos: { type: [enderecoSchema] },
    observacoes: { type: String },
    tags: { type: [String] },
    pf: { type: pfSchema },
    pj: { type: pjSchema },
    origem: { type: origemSchema, default: () => ({ modo: 'manual' }) },
    completude: {
      type: new Schema(
        {
          score: { type: Number },
          camposFaltantes: { type: [String] },
          calculadoEm: { type: Date },
        },
        { _id: false },
      ),
    },
    duplicataSuspeita: {
      type: [
        new Schema(
          {
            contatoId: { type: Schema.Types.ObjectId },
            motivo: { type: String },
            similaridade: { type: Number },
            detectadoEm: { type: Date },
            resolvido: { type: Boolean },
          },
          { _id: false },
        ),
      ],
    },
    relacionados: {
      type: [
        new Schema(
          {
            contatoId: { type: Schema.Types.ObjectId },
            tipo: { type: String, enum: ['matriz', 'filial', 'grupo'] },
          },
          { _id: false },
        ),
      ],
    },
    fundidoEm: { type: Schema.Types.ObjectId },
    avisos: {
      type: [
        new Schema(
          {
            campo: { type: String },
            codigo: { type: String },
            mensagem: { type: String },
          },
          { _id: false },
        ),
      ],
    },
    lgpd: { type: lgpdSchema, default: () => ({}) },
    criadoPor: { type: Schema.Types.ObjectId },
    criadoEm: { type: Date },
    alteradoPor: { type: Schema.Types.ObjectId },
    alteradoEm: { type: Date },
    versao: { type: Number, default: 1 },
    sincronizadoEm: { type: Date },
  },
  { collection: 'contatos', strict: true, versionKey: false },
);

aplicarIndices(contatoSchema, 'contatos');
aplicarIntegridade(contatoSchema);
