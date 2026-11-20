import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContatoLocal, Operacao } from './tipos';
const memoria = vi.hoisted(() => ({
  contato: null as ContatoLocal | null,
  operacoes: [] as Operacao[],
}));
vi.mock('./db', () => ({
  lerContato: vi.fn(async () => structuredClone(memoria.contato)),
  listarOperacoes: vi.fn(async () => structuredClone(memoria.operacoes)),
  apagarOperacao: vi.fn(async (id: string) => {
    memoria.operacoes = memoria.operacoes.filter((op) => op.id !== id);
  }),
  gravarOperacao: vi.fn(async (op: Operacao) => {
    memoria.operacoes = memoria.operacoes.filter((item) => item.id !== op.id);
    memoria.operacoes.push(structuredClone(op));
  }),
}));
vi.mock('./api', () => ({ postarContato: vi.fn(), patchCampo: vi.fn() }));
import { postarContato, patchCampo } from './api';
import { sincronizarContato } from './sincronizar-contato';
const op = (id: string, campo = 'nome', valor = 'Ana', proximaEm = 0): Operacao => ({
  id,
  idLocal: 'local',
  tipo: 'patch',
  campo,
  valor,
  proximaEm,
  tentativas: 0,
});
const definirEstado = vi.fn(
  async (contato: ContatoLocal, estado: ContatoLocal['estado'], tentativas = 0) => {
    memoria.contato = {
      ...memoria.contato!,
      estado,
      tentativas,
      idServidor: contato.idServidor,
      versaoServidor: contato.versaoServidor,
    };
  },
);
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('navigator', { onLine: true });
  memoria.contato = {
    idLocal: 'local',
    campos: { nome: 'Ana' },
    modo: 'manual',
    estado: 'local',
    tentativas: 0,
    atualizadoEm: 1,
  };
  memoria.operacoes = [op('primeira')];
});
describe('confirmação da fila offline', () => {
  it('preserva edição feita durante um POST lento e confirma o PATCH posterior', async () => {
    vi.mocked(postarContato).mockImplementationOnce(async () => {
      memoria.contato!.campos.nome = 'Ana nova';
      memoria.operacoes.push(op('durante-post', 'nome', 'Ana nova'));
      return { http: 201, dados: { _id: 'servidor', versao: 1 } };
    });
    expect(await sincronizarContato('local', [...memoria.operacoes], definirEstado)).toBe(0);
    expect(memoria.operacoes.map((item) => item.id)).toEqual(['durante-post']);
    expect(memoria.contato).toMatchObject({
      idServidor: 'servidor',
      estado: 'local',
      campos: { nome: 'Ana nova' },
    });
    vi.mocked(patchCampo).mockResolvedValueOnce({ http: 200, dados: { versao: 2 } });
    await sincronizarContato('local', [...memoria.operacoes], definirEstado);
    expect(patchCampo).toHaveBeenCalledWith('servidor', 'nome', 'Ana nova', 1);
    expect(memoria.operacoes).toHaveLength(0);
    expect(memoria.contato!.estado).toBe('sincronizado');
  });
  it('não descarta alterações quando reenvio idempotente retorna um registro já existente', async () => {
    memoria.contato!.campos.nome = 'Nome novo';
    vi.mocked(postarContato).mockResolvedValueOnce({
      http: 200,
      dados: { _id: 'servidor', nome: 'Nome antigo', versao: 5 },
    });
    await sincronizarContato('local', [...memoria.operacoes], definirEstado);
    expect(memoria.operacoes).toHaveLength(1);
    expect(memoria.contato!.estado).toBe('local');
    vi.mocked(patchCampo).mockResolvedValueOnce({ http: 200, dados: { versao: 6 } });
    await sincronizarContato('local', [...memoria.operacoes], definirEstado);
    expect(patchCampo).toHaveBeenCalledWith('servidor', 'nome', 'Nome novo', 5);
  });
  it('não ressuscita operação já confirmada quando a próxima falha', async () => {
    memoria.contato!.idServidor = 'servidor';
    memoria.contato!.versaoServidor = 1;
    memoria.operacoes.push(op('segunda', 'email', 'ana@example.test'));
    vi.mocked(patchCampo)
      .mockResolvedValueOnce({ http: 200, dados: { versao: 2 } })
      .mockRejectedValueOnce(new Error('rede'));
    await sincronizarContato('local', [...memoria.operacoes], definirEstado);
    expect(memoria.operacoes.map((item) => item.id)).toEqual(['segunda']);
    expect(memoria.operacoes[0].tentativas).toBe(1);
  });
  it('mantém estado local enquanto há uma operação com retentativa futura', async () => {
    memoria.contato!.idServidor = 'servidor';
    memoria.contato!.versaoServidor = 1;
    memoria.operacoes.push(op('futura', 'email', 'ana@example.test', Date.now() + 60000));
    vi.mocked(patchCampo).mockResolvedValueOnce({ http: 200, dados: { versao: 2 } });
    expect(
      await sincronizarContato('local', [...memoria.operacoes], definirEstado),
    ).toBeGreaterThan(0);
    expect(memoria.contato!.estado).toBe('local');
    expect(memoria.operacoes[0].id).toBe('futura');
  });
});
