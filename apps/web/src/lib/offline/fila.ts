import { patchCampo, postarContato, reportarProfundidade } from './api';
import { atrasoMs } from './atraso';
import {
  apagarOperacao,
  apagarOperacoesDoContato,
  gravarContato,
  gravarOperacao,
  lerContato,
  listarContatos,
  listarOperacoes,
} from './db';
import type { ContatoLocal, EstadoSync, Operacao } from './tipos';

const ouvintes = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;
let drenando = false;

export function observarFila(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

export function criarIdLocal(): string {
  return crypto.randomUUID();
}

export async function garantirContato(
  idLocal: string,
  modo = 'manual',
  payloadBruto?: string,
): Promise<ContatoLocal> {
  const existente = await lerContato(idLocal);
  if (existente) return existente;
  const novo: ContatoLocal = {
    idLocal,
    campos: {},
    modo,
    payloadBruto,
    estado: 'local',
    tentativas: 0,
    atualizadoEm: Date.now(),
  };
  await gravarContato(novo);
  avisar();
  return novo;
}

export async function salvarCampo(
  idLocal: string,
  campo: string,
  valor: string,
): Promise<ContatoLocal> {
  const contato = await garantirContato(idLocal);
  contato.campos[campo] = valor;
  contato.estado = 'local';
  contato.atualizadoEm = Date.now();
  contato.conflito = undefined;
  await gravarContato(contato);
  await gravarOperacao({
    id: crypto.randomUUID(),
    idLocal,
    tipo: contato.idServidor ? 'patch' : 'criar',
    campo,
    valor,
    tentativas: 0,
    proximaEm: Date.now(),
  });
  avisar();
  agendar(0);
  return contato;
}

export async function lerTodos(): Promise<ContatoLocal[]> {
  return listarContatos();
}

export async function lerUm(idLocal: string): Promise<ContatoLocal | undefined> {
  return lerContato(idLocal);
}

export async function resolverConflito(idLocal: string, ficarComLocal: boolean): Promise<void> {
  const contato = await lerContato(idLocal);
  if (!contato?.conflito) return;
  const servidor = contato.conflito.valorServidor;
  if (!ficarComLocal) {
    const valor = servidor[contato.conflito.campo];
    if (typeof valor === 'string') contato.campos[contato.conflito.campo] = valor;
    contato.versaoServidor = Number(servidor.versao ?? contato.versaoServidor);
    contato.conflito = undefined;
    await apagarOperacoesDoContato(idLocal);
    await definirEstado(contato, 'sincronizado', 0);
    return;
  }
  contato.versaoServidor = Number(servidor.versao ?? contato.versaoServidor);
  const campo = contato.conflito.campo;
  const valor = contato.conflito.valorLocal;
  contato.conflito = undefined;
  await apagarOperacoesDoContato(idLocal);
  await gravarOperacao({
    id: crypto.randomUUID(),
    idLocal,
    tipo: 'patch',
    campo,
    valor,
    tentativas: 0,
    proximaEm: Date.now(),
  });
  await definirEstado(contato, 'local', 0);
  agendar(0);
}

export async function jsonDoContato(idLocal: string): Promise<string> {
  return JSON.stringify((await lerContato(idLocal)) ?? { idLocal }, null, 2);
}

export async function profundidadeDaFila(): Promise<number> {
  return (await listarOperacoes()).length;
}

export function iniciarFila(): void {
  window.addEventListener('online', () => agendar(0));
  agendar(0);
}

export function agendar(espera: number): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void drenar(), espera);
}

export async function drenar(): Promise<void> {
  if (drenando) return;
  drenando = true;
  try {
    const operacoes = await listarOperacoes();
    if (navigator.onLine) {
      await reportarProfundidade(operacoes.length).catch(() => undefined);
    }
    const porContato = new Map<string, Operacao[]>();
    for (const operacao of operacoes) {
      const grupo = porContato.get(operacao.idLocal) ?? [];
      grupo.push(operacao);
      porContato.set(operacao.idLocal, grupo);
    }
    let proxima = 5 * 60 * 1000;
    for (const [idLocal, grupo] of porContato) {
      const espera = await sincronizar(idLocal, grupo);
      if (espera !== null) proxima = Math.min(proxima, espera);
    }
    if (porContato.size > 0) agendar(Math.max(proxima, 0));
  } finally {
    drenando = false;
    avisar();
  }
}

async function sincronizar(idLocal: string, grupo: Operacao[]): Promise<number | null> {
  const contato = await lerContato(idLocal);
  if (!contato) return null;
  const prontas = grupo.filter((item) => item.proximaEm <= Date.now());
  if (prontas.length === 0) return Math.min(...grupo.map((item) => item.proximaEm - Date.now()));
  if (!navigator.onLine) return atrasoMs(1);
  await definirEstado(contato, 'enviando');
  try {
    if (!contato.idServidor) {
      const resposta = await postarContato(contato);
      const id = resposta.dados?._id;
      if (!id || typeof id !== 'string') throw new Error('sem id');
      contato.idServidor = id;
      contato.versaoServidor = Number(resposta.dados?.versao ?? 1);
      await apagarOperacoesDoContato(idLocal);
      await definirEstado(contato, 'sincronizado', 0);
      return null;
    }
    for (const operacao of prontas) {
      if (!operacao.campo) {
        await apagarOperacao(operacao.id);
        continue;
      }
      const resposta = await patchCampo(
        contato.idServidor,
        operacao.campo,
        operacao.valor ?? contato.campos[operacao.campo] ?? '',
        contato.versaoServidor,
      );
      if (
        resposta.http === 422 &&
        resposta.erros?.some((erro) => erro.codigo === 'CONFLITO_VERSAO')
      ) {
        contato.conflito = {
          campo: operacao.campo,
          valorLocal: operacao.valor ?? '',
          valorServidor: (resposta.dados as Record<string, unknown>) ?? {},
        };
        await definirEstado(contato, 'conflito');
        return null;
      }
      if (resposta.http >= 400) throw new Error(resposta.erros?.[0]?.codigo ?? 'falha');
      contato.versaoServidor = Number(resposta.dados?.versao ?? contato.versaoServidor);
      await apagarOperacao(operacao.id);
    }
    await definirEstado(contato, 'sincronizado', 0);
    return null;
  } catch {
    const tentativas = contato.tentativas + 1;
    const estado: EstadoSync = tentativas >= 10 ? 'preso' : 'local';
    await definirEstado(contato, estado, tentativas);
    const espera = atrasoMs(tentativas);
    for (const operacao of prontas) {
      operacao.proximaEm = Date.now() + espera;
      operacao.tentativas = tentativas;
      await gravarOperacao(operacao);
    }
    return espera;
  }
}

async function definirEstado(
  contato: ContatoLocal,
  estado: EstadoSync,
  tentativas = contato.tentativas,
): Promise<void> {
  contato.estado = estado;
  contato.tentativas = tentativas;
  contato.atualizadoEm = Date.now();
  if (estado === 'sincronizado') contato.conflito = undefined;
  await gravarContato(contato);
  avisar();
}

function avisar(): void {
  for (const ouvinte of ouvintes) ouvinte();
}
