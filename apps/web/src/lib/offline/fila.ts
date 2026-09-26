import { postarConsentimento, postarResolucao, reportarProfundidade } from './api';
import {
  apagarContato,
  apagarOperacoesDoContato,
  gravarContato,
  gravarOperacao,
  lerContato,
  listarContatos,
  listarOperacoes,
} from './db';
import { emSerie } from './serie';
import { sincronizarContato } from './sincronizar-contato';
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
  let gravado: ContatoLocal | undefined;
  await emSerie(idLocal, async () => {
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
    gravado = contato;
    avisar();
    agendar(0);
  });
  if (!gravado) throw new Error('gravação do campo não concluiu');
  return gravado;
}

export async function lerTodos(): Promise<ContatoLocal[]> {
  return listarContatos();
}

export async function guardarConsentimento(idLocal: string, emDispositivo: string): Promise<void> {
  const contato = await garantirContato(idLocal);
  contato.consentimento = { contatoComercial: true, emDispositivo, estado: 'local' };
  await gravarContato(contato);
  avisar();
  agendar(0);
}

export async function lerUm(idLocal: string): Promise<ContatoLocal | undefined> {
  return lerContato(idLocal);
}

export async function apagarRascunhoLocal(idLocal: string): Promise<boolean> {
  const contato = await lerContato(idLocal);
  if (!contato || contato.idServidor) return false;
  await apagarOperacoesDoContato(idLocal);
  await apagarContato(idLocal);
  avisar();
  return true;
}

export async function resolverConflito(idLocal: string, ficarComLocal: boolean): Promise<void> {
  const contato = await lerContato(idLocal);
  if (!contato?.conflito) return;
  if (contato.idServidor) {
    const resposta = await postarResolucao(
      contato.idServidor,
      ficarComLocal ? 'local' : 'servidor',
    );
    if (resposta.http >= 400) {
      contato.mensagem = resposta.erros?.[0]?.mensagem ?? 'A escolha não foi gravada no servidor.';
      await gravarContato(contato);
      avisar();
      return;
    }
    if (!ficarComLocal) {
      const valor = contato.conflito.valorServidor[contato.conflito.campo];
      if (typeof valor === 'string') contato.campos[contato.conflito.campo] = valor;
    }
    contato.versaoServidor = Number(resposta.dados?.versao ?? contato.versaoServidor);
    contato.conflito = undefined;
    contato.mensagem = undefined;
    await apagarOperacoesDoContato(idLocal);
    await definirEstado(contato, 'sincronizado', 0);
    return;
  }
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

let filaIniciada = false;

export function iniciarFila(): void {
  if (filaIniciada) return;
  filaIniciada = true;
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
      const espera = await sincronizarContato(idLocal, grupo, definirEstado);
      if (espera !== null) proxima = Math.min(proxima, espera);
    }
    if (navigator.onLine) await enviarConsentimentosLocais();
    if (porContato.size > 0) agendar(Math.max(proxima, 0));
  } catch {
    // Sem IndexedDB neste ambiente a fila não drena. A tela continua.
  } finally {
    drenando = false;
    avisar();
  }
}

async function definirEstado(
  contato: ContatoLocal,
  estado: EstadoSync,
  tentativas = contato.tentativas,
): Promise<void> {
  await emSerie(contato.idLocal, async () => {
    const fresco = (await lerContato(contato.idLocal)) ?? contato;
    fresco.estado = estado;
    fresco.tentativas = tentativas;
    fresco.atualizadoEm = Date.now();
    if (contato.idServidor) fresco.idServidor = contato.idServidor;
    if (contato.versaoServidor !== undefined) fresco.versaoServidor = contato.versaoServidor;
    if (contato.avisos) fresco.avisos = contato.avisos;
    if (contato.mensagem) fresco.mensagem = contato.mensagem;
    else if (estado === 'sincronizado') fresco.mensagem = undefined;
    if (estado === 'sincronizado') fresco.conflito = undefined;
    else if (contato.conflito) fresco.conflito = contato.conflito;
    await gravarContato(fresco);
    avisar();
  });
}

async function enviarConsentimentosLocais(): Promise<void> {
  for (const contato of await listarContatos()) {
    const escolha = contato.consentimento;
    if (!escolha?.contatoComercial || escolha.estado === 'enviado' || !contato.idServidor) continue;
    const resposta = await postarConsentimento(contato.idServidor, escolha.emDispositivo).catch(
      () => null,
    );
    if (!resposta || resposta.http >= 400) continue;
    escolha.estado = 'enviado';
    await gravarContato(contato);
  }
}

function avisar(): void {
  for (const ouvinte of ouvintes) ouvinte();
}
