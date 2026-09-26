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
  return abrir().then(
    (banco) =>
      new Promise<T>((resolve, reject) => {
        const tx = banco.transaction(loja, modo);
        const pedido = run(tx.objectStore(loja));
        pedido.onsuccess = () => resolve(pedido.result);
        pedido.onerror = () => reject(pedido.error);
      }),
  );
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
