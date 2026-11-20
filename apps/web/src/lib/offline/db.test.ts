import { afterEach, describe, expect, it, vi } from 'vitest';
import { gravarContato, gravarContatoComOperacao } from './db';
import type { ContatoLocal } from './tipos';
const contato: ContatoLocal = {
  idLocal: 'local',
  campos: { nome: 'Ana' },
  modo: 'manual',
  estado: 'local',
  tentativas: 0,
  atualizadoEm: 1,
};
function bancoControlado() {
  const pedido = { result: 'local', onsuccess: null as (() => void) | null };
  const put = vi.fn(() => pedido);
  const tx = {
    objectStore: vi.fn(() => ({ put })),
    oncomplete: null as (() => void) | null,
    onabort: null as (() => void) | null,
    onerror: null as (() => void) | null,
    error: null as Error | null,
    abort: vi.fn(),
  };
  const banco = { transaction: vi.fn(() => tx), close: vi.fn() };
  vi.stubGlobal('indexedDB', {
    open: () => {
      const abrir = { result: banco, onsuccess: null as (() => void) | null };
      queueMicrotask(() => abrir.onsuccess?.());
      return abrir;
    },
  });
  return { pedido, tx, banco, put };
}
afterEach(() => vi.unstubAllGlobals());
describe('commit da captura local', () => {
  it('só confirma gravação depois do commit da transação, fechando a conexão', async () => {
    const { pedido, tx, banco } = bancoControlado();
    let confirmado = false;
    const salvo = gravarContato(contato).then(() => {
      confirmado = true;
    });
    await vi.waitFor(() => expect(banco.transaction).toHaveBeenCalled());
    pedido.onsuccess?.();
    await Promise.resolve();
    expect(confirmado).toBe(false);
    tx.oncomplete?.();
    await salvo;
    expect(confirmado).toBe(true);
    expect(banco.close).toHaveBeenCalledOnce();
  });
  it('propaga abort após request bem sucedida e mantém contato e operação na mesma transação', async () => {
    const { pedido, tx, banco, put } = bancoControlado();
    const salvo = gravarContatoComOperacao(contato, {
      id: 'op',
      idLocal: 'local',
      tipo: 'criar',
      campo: 'nome',
      valor: 'Ana',
      tentativas: 0,
      proximaEm: 0,
    });
    const rejeitado = expect(salvo).rejects.toThrow('quota');
    await vi.waitFor(() => expect(banco.transaction).toHaveBeenCalled());
    expect(banco.transaction).toHaveBeenCalledWith(['contatos', 'operacoes'], 'readwrite');
    expect(put).toHaveBeenCalledTimes(2);
    pedido.onsuccess?.();
    tx.error = new Error('quota');
    tx.onabort?.();
    await rejeitado;
    expect(banco.close).toHaveBeenCalledOnce();
  });
});
