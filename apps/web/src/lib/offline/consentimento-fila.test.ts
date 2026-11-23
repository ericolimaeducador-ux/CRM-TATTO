import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContatoLocal } from './tipos';

const memoria = vi.hoisted(() => ({ contatos: [] as ContatoLocal[] }));
vi.mock('./db', () => ({
  listarContatos: vi.fn(async () => structuredClone(memoria.contatos)),
  lerContato: vi.fn(async (id: string) =>
    structuredClone(memoria.contatos.find((c) => c.idLocal === id)),
  ),
  gravarContato: vi.fn(async (c: ContatoLocal) => {
    memoria.contatos = memoria.contatos.map((item) =>
      item.idLocal === c.idLocal ? structuredClone(c) : item,
    );
  }),
}));
vi.mock('./api', () => ({
  postarConsentimento: vi.fn(),
  postarResolucao: vi.fn(),
  reportarProfundidade: vi.fn(),
}));
import { postarConsentimento } from './api';
import { enviarConsentimentosLocais } from './fila';

function contato(idServidor?: string): ContatoLocal {
  return {
    idLocal: 'local-1',
    ...(idServidor ? { idServidor } : {}),
    consentimento: {
      contatoComercial: true,
      emDispositivo: '2026-11-23T12:00:00.000Z',
      envioErp: false,
      estado: 'local',
    },
  } as ContatoLocal;
}

describe('aceite guardado no aparelho', () => {
  beforeEach(() => vi.mocked(postarConsentimento).mockReset());

  it('continua pendente quando o envio falha, para a fila tentar de novo', async () => {
    memoria.contatos = [contato('507f1f77bcf86cd799439011')];
    vi.mocked(postarConsentimento).mockRejectedValueOnce(new Error('sem rede'));
    expect(await enviarConsentimentosLocais()).toBe(true);
    expect(memoria.contatos[0].consentimento?.estado).toBe('local');
  });

  it('continua pendente enquanto o contato ainda não chegou ao servidor', async () => {
    memoria.contatos = [contato()];
    expect(await enviarConsentimentosLocais()).toBe(true);
    expect(postarConsentimento).not.toHaveBeenCalled();
  });

  it('marca como enviado quando o servidor confirma', async () => {
    memoria.contatos = [contato('507f1f77bcf86cd799439011')];
    vi.mocked(postarConsentimento).mockResolvedValueOnce({ http: 200 } as never);
    expect(await enviarConsentimentosLocais()).toBe(false);
    expect(memoria.contatos[0].consentimento?.estado).toBe('enviado');
  });
});
