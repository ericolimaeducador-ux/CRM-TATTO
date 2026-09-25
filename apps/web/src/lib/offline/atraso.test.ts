import { atrasoMs } from './atraso';

describe('atraso da fila', () => {
  const gancho = globalThis as { __CAPTURA7_BACKOFF_MS?: number };

  afterEach(() => {
    delete gancho.__CAPTURA7_BACKOFF_MS;
  });

  it('dobra até o teto de cinco minutos e não desiste', () => {
    expect(atrasoMs(1)).toBe(1_000);
    expect(atrasoMs(2)).toBe(2_000);
    expect(atrasoMs(3)).toBe(4_000);
    expect(atrasoMs(20)).toBe(5 * 60 * 1000);
  });

  it('aceita o gancho de teste sem gravar isso no repositório', () => {
    gancho.__CAPTURA7_BACKOFF_MS = 0;
    expect(atrasoMs(9)).toBe(0);
  });
});
