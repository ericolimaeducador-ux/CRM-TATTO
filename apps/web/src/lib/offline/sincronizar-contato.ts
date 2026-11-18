import { patchCampo, postarContato } from './api';
import { atrasoMs } from './atraso';
import { apagarOperacao, gravarOperacao, lerContato, listarOperacoes } from './db';
import type { ContatoLocal, EstadoSync, Operacao } from './tipos';

type DefinirEstado = (
  contato: ContatoLocal,
  estado: EstadoSync,
  tentativas?: number,
) => Promise<void>;

export async function sincronizarContato(
  idLocal: string,
  grupo: Operacao[],
  definirEstado: DefinirEstado,
): Promise<number | null> {
  const contato = await lerContato(idLocal);
  if (!contato) return null;
  const prontas = grupo.filter((item) => item.proximaEm <= Date.now());
  if (prontas.length === 0) return Math.min(...grupo.map((item) => item.proximaEm - Date.now()));
  if (!navigator.onLine) return atrasoMs(1);
  await definirEstado(contato, 'enviando');
  try {
    if (!contato.idServidor) return await criar(contato, prontas, definirEstado);
    for (const operacao of prontas) {
      if (!operacao.campo) {
        await apagarOperacao(operacao.id);
        continue;
      }
      const valorEnviado = contato.campos[operacao.campo] ?? operacao.valor ?? '';
      const resposta = await patchCampo(
        contato.idServidor,
        operacao.campo,
        valorEnviado,
        contato.versaoServidor,
      );
      if (
        resposta.http === 422 &&
        resposta.erros?.some((erro) => erro.codigo === 'CONFLITO_VERSAO')
      ) {
        contato.conflito = {
          operacaoId: operacao.id,
          campo: operacao.campo,
          valorLocal: valorEnviado,
          valorServidor: (resposta.dados as Record<string, unknown>) ?? {},
        };
        await definirEstado(contato, 'conflito');
        return null;
      }
      if (guardarDuplicata(contato, resposta.erros)) {
        await definirEstado(contato, 'preso', Math.max(contato.tentativas, 10));
        return atrasoMs(10);
      }
      if (resposta.http >= 400) throw new Error(resposta.erros?.[0]?.codigo ?? 'falha');
      contato.avisos = resposta.avisos ?? [];
      contato.mensagem = undefined;
      contato.versaoServidor = Number(resposta.dados?.versao ?? contato.versaoServidor);
      await apagarOperacao(operacao.id);
    }
    return await concluir(contato, definirEstado);
  } catch {
    const tentativas = contato.tentativas + 1;
    const estado: EstadoSync = tentativas >= 10 ? 'preso' : 'local';
    await definirEstado(contato, estado, tentativas);
    const espera = atrasoMs(tentativas);
    const existentes = new Set((await listarOperacoes()).map((item) => item.id));
    for (const operacao of prontas.filter((item) => existentes.has(item.id))) {
      operacao.proximaEm = Date.now() + espera;
      operacao.tentativas = tentativas;
      await gravarOperacao(operacao);
    }
    return espera;
  }
}

async function criar(
  contato: ContatoLocal,
  enviadas: Operacao[],
  definirEstado: DefinirEstado,
): Promise<number | null> {
  const resposta = await postarContato(contato);
  const id = resposta.dados?._id;
  if (!id || typeof id !== 'string') throw new Error('sem id');
  contato.avisos = resposta.avisos ?? [];
  contato.mensagem = undefined;
  contato.idServidor = id;
  contato.versaoServidor = Number(resposta.dados?.versao ?? 1);
  if (guardarDuplicata(contato, resposta.erros)) {
    await definirEstado(contato, 'preso', Math.max(contato.tentativas, 10));
    return atrasoMs(10);
  }
  if (resposta.http >= 400) throw new Error(resposta.erros?.[0]?.codigo ?? 'falha');
  // Só 201 confirma que esta foto criou o registro. Um 200 pode ser o reenvio
  // de uma criação cuja resposta se perdeu; suas operações ainda precisam de PATCH.
  if (resposta.http === 201) {
    for (const operacao of enviadas) await apagarOperacao(operacao.id);
  }
  return concluir(contato, definirEstado);
}

async function concluir(
  contato: ContatoLocal,
  definirEstado: DefinirEstado,
): Promise<number | null> {
  const pendentes = (await listarOperacoes()).filter((item) => item.idLocal === contato.idLocal);
  await definirEstado(contato, pendentes.length ? 'local' : 'sincronizado', 0);
  return pendentes.length
    ? Math.max(0, Math.min(...pendentes.map((item) => item.proximaEm - Date.now())))
    : null;
}

function guardarDuplicata(
  contato: ContatoLocal,
  erros: { codigo: string; mensagem: string }[] | undefined,
): boolean {
  const duplicata = erros?.find(
    (erro) => erro.codigo === 'CPF_DUPLICADO' || erro.codigo === 'CNPJ_DUPLICADO',
  );
  if (!duplicata) return false;
  contato.mensagem = duplicata.mensagem;
  return true;
}
