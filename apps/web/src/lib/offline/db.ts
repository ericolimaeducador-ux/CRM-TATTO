import type { ContatoLocal, Operacao } from './tipos';

const NOME = 'captura7';
const VERSAO = 1;

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.open(NOME, VERSAO);
    pedido.onupgradeneeded = () => {
      const banco = pedido.result;
      if (!banco.objectStoreNames.contains('contatos'))
        banco.createObjectStore('contatos', { keyPath: 'idLocal' });
      if (!banco.objectStoreNames.contains('operacoes')) {
        const ops = banco.createObjectStore('operacoes', { keyPath: 'id' });
        ops.createIndex('idLocal', 'idLocal');
      }
    };
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}

function transacao<T>(
  loja: 'contatos' | 'operacoes',
  modo: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return executarTransacao([loja], modo, (tx) => run(tx.objectStore(loja)));
}

function executarTransacao<T>(
  lojas: ('contatos' | 'operacoes')[],
  modo: IDBTransactionMode,
  run: (tx: IDBTransaction) => IDBRequest<T>,
): Promise<T> {
  return abrir().then(
    (banco) =>
      new Promise<T>((resolve, reject) => {
        const tx = banco.transaction(lojas, modo);
        let resultado: T;
        tx.oncomplete = () => {
          banco.close();
          resolve(resultado);
        };
        tx.onerror = () => {
          banco.close();
          reject(tx.error ?? new Error('Falha na gravação local.'));
        };
        tx.onabort = () => {
          banco.close();
          reject(tx.error ?? new Error('Gravação local cancelada.'));
        };
        try {
          const pedido = run(tx);
          pedido.onsuccess = () => {
            resultado = pedido.result;
          };
        } catch (erro) {
          tx.abort();
          banco.close();
          reject(erro);
        }
      }),
  );
}

export function gravarContatoComOperacao(contato: ContatoLocal, operacao: Operacao): Promise<void> {
  return executarTransacao(['contatos', 'operacoes'], 'readwrite', (tx) => {
    tx.objectStore('contatos').put(contato);
    return tx.objectStore('operacoes').put(operacao);
  }).then(() => undefined);
}

export function gravarContato(contato: ContatoLocal): Promise<void> {
  return transacao('contatos', 'readwrite', (store) => store.put(contato)).then(() => undefined);
}

export function apagarContato(idLocal: string): Promise<void> {
  return transacao('contatos', 'readwrite', (store) => store.delete(idLocal)).then(() => undefined);
}

export function lerContato(idLocal: string): Promise<ContatoLocal | undefined> {
  return transacao('contatos', 'readonly', (store) => store.get(idLocal));
}

export function listarContatos(): Promise<ContatoLocal[]> {
  return transacao('contatos', 'readonly', (store) => store.getAll());
}

export function gravarOperacao(operacao: Operacao): Promise<void> {
  return transacao('operacoes', 'readwrite', (store) => store.put(operacao)).then(() => undefined);
}

export function listarOperacoes(): Promise<Operacao[]> {
  return transacao('operacoes', 'readonly', (store) => store.getAll());
}

export function apagarOperacao(id: string): Promise<void> {
  return transacao('operacoes', 'readwrite', (store) => store.delete(id)).then(() => undefined);
}

export async function apagarOperacoesDoContato(idLocal: string): Promise<void> {
  const todas = await listarOperacoes();
  await Promise.all(
    todas.filter((item) => item.idLocal === idLocal).map((item) => apagarOperacao(item.id)),
  );
}
