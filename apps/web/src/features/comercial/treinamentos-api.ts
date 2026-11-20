import { urlDaApi } from '@/lib/api-url';
import type { Registro } from './api';
export interface Treinamento extends Omit<Registro, 'secao'> {
  secao: 'treinamentos';
  dataInicio: string;
  dataFim?: string;
  linkAcesso?: string;
  grupoGenerico?: string;
  marca?: string;
  motivoTreinamento?: string;
}
export interface Participante extends Omit<Registro, 'secao'> {
  secao: 'participantes';
  treinamentoId: string;
  nome?: string;
  cargo?: string;
  email?: string;
  telefone?: string;
  origem?: string;
  confirmado?: boolean;
  presente?: boolean;
}
export interface ListaTreinamentos {
  registros: Treinamento[];
  total: number;
  pagina: number;
  limite: number;
}
export interface ListaParticipantes {
  registros: Participante[];
  total: number;
  pagina: number;
  limite: number;
}
export interface TreinamentoPublico {
  titulo?: string;
  tipo?: string;
  dataInicio?: string;
  dataFim?: string;
  linkAcesso?: string;
  marca?: string;
  descricao?: string;
}
export function urlInscricaoTreinamento(token: string) {
  return new URL(
    `${import.meta.env.BASE_URL}inscricao-treinamento/${encodeURIComponent(token)}`,
    window.location.origin,
  ).toString();
}
export function linkSeguro(valor?: string) {
  if (!valor) return null;
  try {
    const url = new URL(valor);
    return ['https:', 'http:'].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}
export async function publicoTreinamento<T>(token: string, corpo?: unknown): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(
      urlDaApi(`/v1/comercial/publico/treinamentos/${encodeURIComponent(token)}`),
      {
        method: corpo === undefined ? 'GET' : 'POST',
        ...(corpo === undefined
          ? {}
          : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) }),
      },
    );
  } catch {
    throw new Error('Sem conexão com o treinamento. Confira sua rede e tente novamente.');
  }
  let json: { erros?: { mensagem?: string }[]; message?: string };
  try {
    json = await resposta.json();
  } catch {
    throw new Error('Não foi possível consultar este treinamento agora. Tente novamente.');
  }
  if (!resposta.ok)
    throw new Error(
      json.erros?.[0]?.mensagem ??
        json.message ??
        (resposta.status === 410
          ? 'Este treinamento não aceita mais inscrições por este QR.'
          : 'Não consegui concluir a consulta.'),
    );
  return json as T;
}
