import { marcarServidorAcordando } from '../acordar';
import { patchCampo, postarContato } from './api';
import { atrasoMs } from './atraso';
import { apagarOperacao, apagarOperacoesDoContato, gravarOperacao, lerContato } from './db';
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
    if (!contato.idServidor) return await criar(contato, idLocal, definirEstado);
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
      if (guardarDuplicata(contato, resposta.erros)) {
        await apagarOperacao(operacao.id);
        await definirEstado(contato, 'local');
        continue;
      }
      if (resposta.http >= 400) throw new Error(resposta.erros?.[0]?.codigo ?? 'falha');
      contato.avisos = resposta.avisos ?? [];
      contato.mensagem = undefined;
      contato.versaoServidor = Number(resposta.dados?.versao ?? contato.versaoServidor);
      await apagarOperacao(operacao.id);
    }
    await definirEstado(contato, 'sincronizado', 0);
    marcarServidorAcordando(false);
    return null;
  } catch {
    marcarServidorAcordando(true);
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

async function criar(
  contato: ContatoLocal,
  idLocal: string,
  definirEstado: DefinirEstado,
): Promise<number | null> {
  const resposta = await postarContato(contato);
  if (guardarDuplicata(contato, resposta.erros)) {
    await apagarOperacoesDoContato(idLocal);
    await definirEstado(contato, 'local');
    return null;
  }
  const id = resposta.dados?._id;
  if (!id || typeof id !== 'string') throw new Error('sem id');
  contato.avisos = resposta.avisos ?? [];
  contato.mensagem = undefined;
  contato.idServidor = id;
  contato.versaoServidor = Number(resposta.dados?.versao ?? 1);
  await apagarOperacoesDoContato(idLocal);
  await definirEstado(contato, 'sincronizado', 0);
  marcarServidorAcordando(false);
  return null;
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
