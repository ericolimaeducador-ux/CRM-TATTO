import { urlDaApi } from '@/lib/api-url';
import { cabecalhosDaSessao } from '@/lib/offline/sessao';

export interface CadenciaCampanha {
  intervaloSegundos: number;
  loteTamanho: number;
  pausaLoteSegundos: number;
  tetoDiario: number;
  inicioManha: string;
  fimManha: string;
  inicioTarde: string;
  fimTarde: string;
}
export interface TemplateCampanha {
  id: string;
  nome: string;
  idioma: string;
  corpo: string;
  status?: string;
  categoria?: string;
}
export interface EventoCampanha {
  acao: string;
  autor: string;
  em: string;
  versao: number;
  campos: string[];
}
export interface Campanha {
  _id: string;
  titulo: string;
  mensagem: string;
  contatosIds: string[];
  template: TemplateCampanha | null;
  cadencia: CadenciaCampanha;
  estado:
    | 'rascunho'
    | 'preparando'
    | 'preparada'
    | 'em_andamento'
    | 'pausada'
    | 'concluida'
    | 'cancelada';
  versao: number;
  criadoEm: string;
  alteradoEm: string;
}
export interface ConfigCampanhas {
  envioAtivo: boolean;
  configuracaoCompleta: boolean;
  faltantes: string[];
  limitePublico: number;
}
export interface CandidatoCampanha {
  id: string;
  nome: string;
  telefoneMascarado: string;
  status: string;
  origem: string;
  tags: string[];
  elegivel: boolean;
  motivo: string;
}
export interface ListaCampanhas<T> {
  registros: T[];
  total: number;
  pagina: number;
  limite: number;
}
export interface PreviaCampanha {
  selecionados: number;
  elegiveis: number;
  excluidos: number;
  duplicados: number;
  destinatarios: {
    contatoId: string;
    nome: string;
    telefoneMascarado: string;
    elegivel: boolean;
    motivo: string;
  }[];
  mensagem: string;
  templateCompativel: boolean;
}
export interface ResultadoCampanha {
  resumo: Record<string, number>;
  respondidos: number;
  registros: {
    _id: string;
    contatoId: string;
    telefoneMascarado: string;
    estado: string;
    motivo: string;
    tentativas: number;
    respondeuEm: string | null;
  }[];
  total: number;
  pagina: number;
  limite: number;
  diario: number;
  proximaSaidaEm: string | null;
  aviso: string;
}
export const CADENCIA_INICIAL: CadenciaCampanha = {
  intervaloSegundos: 90,
  loteTamanho: 20,
  pausaLoteSegundos: 600,
  tetoDiario: 50,
  inicioManha: '09:00',
  fimManha: '12:00',
  inicioTarde: '14:00',
  fimTarde: '17:00',
};
export const MENSAGEM_CAMPANHA = `Olá! Aqui é o Erico, da Tela Viva, representante Pele Rara® para o segmento de tatuagem.

Retomando nosso contato na Tattoo Week, compartilho este vídeo de apresentação da tecnologia BioCic® da Pele Rara:
https://www.youtube.com/watch?v=K-dAS5cQBQQ

Gostaria de conhecer o portfólio e conversar sobre uma parceria para o seu estúdio?

Se preferir não receber novas mensagens, responda SAIR.`;
export class ErroCampanha extends Error {
  constructor(
    mensagem: string,
    public status = 0,
  ) {
    super(mensagem);
  }
}
export async function apiCampanhas<T>(caminho = '', metodo = 'GET', corpo?: unknown): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(urlDaApi(`/v1/campanhas${caminho}`), {
      method: metodo,
      headers: cabecalhosDaSessao(),
      ...(corpo !== undefined ? { body: JSON.stringify(corpo) } : {}),
    });
  } catch {
    throw new ErroCampanha(
      'Sem conexão com as campanhas. A alteração não foi confirmada; seus campos continuam nesta tela.',
    );
  }
  const json = (await resposta.json().catch(() => null)) as {
    mensagem?: string;
    message?: string;
    erros?: { mensagem?: string }[];
  } | null;
  if (!resposta.ok)
    throw new ErroCampanha(
      resposta.status === 401 || resposta.status === 403
        ? 'Sua sessão não permite esta ação. Entre com um perfil de gestor ou administrador.'
        : (json?.erros?.[0]?.mensagem ??
            json?.mensagem ??
            json?.message ??
            'A operação não foi confirmada. Tente novamente.'),
      resposta.status,
    );
  if (!json)
    throw new ErroCampanha(
      'O servidor não respondeu como esperado. Confira a conexão e tente novamente.',
    );
  return json as T;
}
export const ESTADOS_CAMPANHA: Record<string, string> = {
  rascunho: 'Rascunho',
  preparando: 'Em preparação',
  preparada: 'Preparada',
  em_andamento: 'Em andamento',
  pausada: 'Pausada',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
  pendente: 'Pendente',
  processando: 'Em processamento',
  aceito: 'Aceito pela Meta',
  enviado: 'Enviado',
  entregue: 'Entregue',
  lido: 'Lido',
  falha: 'Falha',
  incerto: 'Incerto',
  excluido: 'Excluído',
  cancelado: 'Cancelado',
};
export const MOTIVOS_CAMPANHA: Record<string, string> = {
  contato_indisponivel: 'Contato descartado, eliminado, fundido ou indisponível',
  sem_autorizacao_documentada: 'Sem autorização comercial documentada',
  sem_telefone_valido: 'Sem telefone válido para WhatsApp',
  destinatario_solicitou_parada: 'Solicitou parar as mensagens',
  telefone_duplicado: 'Telefone repetido nesta campanha',
  telefone_alterado: 'Telefone alterado após a preparação',
  destinatario_respondeu: 'Resposta recebida; atendimento deve continuar com a equipe',
  campanha_cancelada: 'Campanha cancelada',
  http_429: 'Limite temporário da Meta; aguardando nova tentativa',
  resultado_ambiguo_verificar_meta:
    'Resultado incerto; confira na Meta antes de qualquer novo envio',
  reserva_perdida_verificar_meta:
    'Processamento interrompido; confira na Meta, sem reenvio automático',
};
export const motivoCampanha = (valor: string) =>
  MOTIVOS_CAMPANHA[valor] ?? (valor ? valor.replaceAll('_', ' ') : 'Elegível');
