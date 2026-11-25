import { Schema } from 'mongoose';

/**
 * O envelope comercial permanece único e versionado. Os novos tipos são aditivos;
 * os documentos existentes e a captura offline não mudam de formato.
 */
export const TIPOS = [
  'contas',
  'produtos',
  'oportunidades',
  'atividades',
  'propostas',
  'precosCliente',
  'treinamentos',
  'participantes',
] as const;
export type TipoComercial = (typeof TIPOS)[number];
export const ETAPAS = [
  'prospeccao',
  'qualificacao',
  'apresentacao',
  'proposta',
  'negociacao',
  'ganho',
  'perdido',
];
export interface EventoComercial {
  acao: string;
  autor: string;
  em: Date;
  versao: number;
  campos: string[];
  resumoHash: string;
}
export interface DocumentoComercial {
  tipo: TipoComercial;
  donoId: string;
  versao: number;
  criadoEm: Date;
  alteradoEm: Date;
  criadoPor: string;
  alteradoPor: string;
  arquivado: boolean;
  campos: Record<string, unknown>;
  auditoria: EventoComercial[];
}

/** Contato é embutido em `contas.campos.pessoas` para seguir o ciclo da própria conta. */
export interface PessoaConta {
  id: string;
  nome: string;
  cargo?: string;
  email?: string;
  telefone?: string;
  principal?: boolean;
  ativo?: boolean;
  observacoes?: string;
}

/**
 * Campos persistidos nos tipos aditivos (o envelope `campos` é Mixed para preservar
 * compatibilidade). Tokens QR devem ser persistidos somente como hash.
 */
export interface PrecoCliente {
  contaId: string;
  produtoId: string;
  precoCentavos: number;
  status: 'solicitado' | 'aguardando_aprovacao' | 'aprovado' | 'reprovado' | 'encerrado';
  motivo?: string;
  validade?: string;
}
export interface Treinamento {
  titulo: string;
  tipo: 'online' | 'presencial';
  dataInicio: string;
  dataFim?: string;
  contaId?: string;
  oportunidadeId?: string;
  tokenInscricaoHash?: string;
  tokenInscricaoExpiraEm?: Date;
}
export interface ParticipanteTreinamento {
  treinamentoId: string;
  nome: string;
  email?: string;
  telefone?: string;
  confirmado?: boolean;
  presente?: boolean;
  confirmadoEm?: Date;
}
export const comercialSchema = new Schema<DocumentoComercial>(
  {
    tipo: { type: String, enum: TIPOS, required: true },
    donoId: { type: String, required: true },
    versao: { type: Number, default: 1 },
    criadoEm: { type: Date, required: true },
    alteradoEm: { type: Date, required: true },
    criadoPor: { type: String, required: true },
    alteradoPor: { type: String, required: true },
    arquivado: { type: Boolean, default: false },
    campos: { type: Schema.Types.Mixed, required: true },
    auditoria: {
      type: [
        new Schema<EventoComercial>(
          {
            acao: String,
            autor: String,
            em: Date,
            versao: Number,
            campos: [String],
            resumoHash: String,
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { collection: 'tela_viva_comercial', versionKey: false },
);
comercialSchema.index({ tipo: 1, donoId: 1, arquivado: 1, alteradoEm: -1 });
comercialSchema.index({ tipo: 1, 'campos.contaId': 1 });
// Conta criada a partir do contato qualificado (ADR-028): no máximo uma por contato.
comercialSchema.index(
  { 'campos.contatoOrigemId': 1 },
  {
    unique: true,
    partialFilterExpression: { tipo: 'contas', 'campos.contatoOrigemId': { $exists: true } },
  },
);
// Busca e histórico de preço por conta e produto; não há índice único porque
// propostas/condições históricas precisam coexistir e ser auditáveis.
comercialSchema.index({
  tipo: 1,
  donoId: 1,
  'campos.contaId': 1,
  'campos.produtoId': 1,
  'campos.status': 1,
});
// Agenda de treinamentos por carteira, data e estado.
comercialSchema.index({
  tipo: 1,
  donoId: 1,
  'campos.dataInicio': 1,
  'campos.status': 1,
});
// Participantes consultados por treinamento e estado de confirmação/presença.
comercialSchema.index({
  tipo: 1,
  donoId: 1,
  'campos.treinamentoId': 1,
  'campos.presente': 1,
});
// Evita inscrições repetidas do mesmo e-mail no mesmo treinamento sem manter
// endereço em claro no índice; a chave do evento permite inscrição em outros eventos.
comercialSchema.index(
  { tipo: 1, donoId: 1, 'campos.treinamentoId': 1, 'campos.emailHash': 1 },
  {
    unique: true,
    partialFilterExpression: {
      tipo: 'participantes',
      'campos.emailHash': { $type: 'string' },
      'campos.treinamentoId': { $type: 'string' },
    },
  },
);
// QR usa digest, nunca o segredo claro. Índice único parcial deixa os registros
// antigos e eventos sem inscrição pública válidos.
comercialSchema.index(
  { tipo: 1, 'campos.tokenInscricaoHash': 1 },
  {
    unique: true,
    partialFilterExpression: {
      tipo: 'treinamentos',
      'campos.tokenInscricaoHash': { $type: 'string' },
    },
  },
);
