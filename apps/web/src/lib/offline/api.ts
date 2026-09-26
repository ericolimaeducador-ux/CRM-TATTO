import { urlDaApi } from '../api-url';
import { cabecalhosDaSessao } from './sessao';
import type { ContatoLocal, RespostaEscrita } from './tipos';

async function enviar(caminho: string, metodo: string, corpo: unknown): Promise<RespostaEscrita> {
  const resposta = await fetch(urlDaApi(caminho), {
    method: metodo,
    headers: cabecalhosDaSessao(),
    body: JSON.stringify(corpo),
  });
  const json = (await resposta.json()) as Omit<RespostaEscrita, 'http'>;
  return { http: resposta.status, ...json };
}

export function postarContato(contato: ContatoLocal): Promise<RespostaEscrita> {
  return enviar('/v1/contatos', 'POST', {
    idLocal: contato.idLocal,
    ...contato.campos,
    origem: {
      modo: contato.modo,
      ...(contato.payloadBruto ? { payloadBruto: contato.payloadBruto } : {}),
    },
  });
}

export function postarLote(itens: ContatoLocal[], profundidade: number): Promise<RespostaEscrita> {
  return enviar('/v1/contatos/lote', 'POST', {
    profundidade,
    itens: itens.map((contato) => ({
      idLocal: contato.idLocal,
      ...contato.campos,
      origem: {
        modo: contato.modo,
        ...(contato.payloadBruto ? { payloadBruto: contato.payloadBruto } : {}),
      },
    })),
  });
}

export function reportarProfundidade(profundidade: number): Promise<RespostaEscrita> {
  return postarLote([], profundidade);
}

export function postarConsentimento(
  idServidor: string,
  emDispositivo: string,
  envioErp = false,
): Promise<RespostaEscrita> {
  return enviar(`/v1/contatos/${idServidor}/consentimento`, 'POST', {
    contatoComercial: true,
    emDispositivo,
    envioErp,
  });
}

export function postarResolucao(
  idServidor: string,
  escolha: 'local' | 'servidor',
): Promise<RespostaEscrita> {
  return enviar(`/v1/contatos/${idServidor}/resolucao`, 'POST', { escolha });
}

export function patchCampo(
  idServidor: string,
  campo: string,
  valor: string,
  versaoConhecida: number | undefined,
): Promise<RespostaEscrita> {
  return enviar(`/v1/contatos/${idServidor}`, 'PATCH', { campo, valor, versaoConhecida });
}
