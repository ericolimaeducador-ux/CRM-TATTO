import { Types } from 'mongoose';

export const MENSAGEM_INICIAL = `Olá! Aqui é o Erico, da Tela Viva, representante Pele Rara® para o segmento de tatuagem.

Retomando nosso contato na Tattoo Week, compartilho este vídeo de apresentação da tecnologia BioCic® da Pele Rara:
https://www.youtube.com/watch?v=K-dAS5cQBQQ

Gostaria de conhecer o portfólio e conversar sobre uma parceria para o seu estúdio?

Se preferir não receber novas mensagens, responda SAIR.`;

export interface Cadencia {
  intervaloSegundos: number;
  loteTamanho: number;
  pausaLoteSegundos: number;
  tetoDiario: number;
  inicioManha: string;
  fimManha: string;
  inicioTarde: string;
  fimTarde: string;
}
export const CADENCIA_PADRAO: Cadencia = {
  intervaloSegundos: 90,
  loteTamanho: 20,
  pausaLoteSegundos: 600,
  tetoDiario: 50,
  inicioManha: '09:00',
  fimManha: '12:00',
  inicioTarde: '14:00',
  fimTarde: '17:00',
};
export interface ModeloCampanha {
  id: string;
  nome: string;
  idioma: string;
  corpo: string;
  status: string;
  categoria: string;
}
export interface EventoCampanha {
  acao: string;
  autor: string;
  em: Date;
  versao: number;
  campos: string[];
}
/**
 * api: Cloud API oficial da Meta (template aprovado, fila automática).
 * manual: o gestor abre cada conversa no WhatsApp Web com o texto pronto e clica enviar.
 * O modo manual nunca dispara envio automático.
 */
export type ModoEnvio = 'api' | 'manual';
export const MODOS_ENVIO: readonly ModoEnvio[] = ['api', 'manual'];
export type EstadoCampanha =
  'rascunho' | 'preparando' | 'preparada' | 'em_andamento' | 'pausada' | 'cancelada' | 'concluida';
export interface Campanha {
  _id: Types.ObjectId;
  titulo: string;
  mensagem: string;
  contatosIds: string[];
  template: ModeloCampanha | null;
  cadencia: Cadencia;
  /** Ausente em campanhas antigas = 'api'. */
  modo?: ModoEnvio;
  estado: EstadoCampanha;
  versao: number;
  criadoPor: string;
  criadoEm: Date;
  alteradoEm: Date;
  preparadaEm?: Date;
  iniciadaEm?: Date;
  auditoria: EventoCampanha[];
}
export type EstadoDestinatario =
  | 'pendente'
  | 'processando'
  | 'aceito'
  | 'enviado'
  | 'entregue'
  | 'lido'
  | 'falha'
  | 'incerto'
  | 'excluido'
  | 'cancelado'
  /** Envio manual: conversa aberta no WhatsApp Web; quem clica enviar é o gestor. */
  | 'aberto_manual';
export interface Destinatario {
  _id: Types.ObjectId;
  campanhaId: Types.ObjectId;
  contatoId: Types.ObjectId;
  telefoneHash: string;
  telefoneMascarado: string;
  estado: EstadoDestinatario;
  motivo: string;
  tentativas: number;
  proximaTentativaEm: Date;
  criadoEm: Date;
  atualizadoEm: Date;
  reservaId?: string;
  reservaAte?: Date;
  /** Modo manual: primeira abertura no WhatsApp Web. */
  abertoEm?: Date;
  mensagemId?: string;
  nivelRecibo?: number;
  eventos: { estado: string; em: Date; autor: string; tentativa: number; codigo: string }[];
}
export interface ControleCampanha {
  _id: string;
  reservaId?: string;
  reservaAte: Date;
  proximaSaidaEm: Date;
  ultimaSaidaEm?: Date;
  dia: string;
  diario: number;
  lote: number;
  pausaAte?: Date;
}
export interface LeadCampanha {
  _id: Types.ObjectId;
  nome?: string;
  status?: string;
  criadoEm?: Date;
  fundidoEm?: unknown;
  origem?: { modo?: string };
  tags?: string[];
  telefones?: { e164?: string; bruto?: string; principal?: boolean; whatsapp?: boolean }[];
  lgpd?: {
    contatoComercial?: string;
    revogadoEm?: Date;
    eliminadoEm?: Date;
    consentimentos?: {
      finalidade?: string;
      revogadoEm?: Date;
      versaoTermo?: string;
      hashTexto?: string;
    }[];
  };
}
