import { ExpurgoService } from './expurgo.service';

describe('expurgo por inatividade', () => {
  it('elimina inatividade, revogação antiga e rascunho parado, e apaga o já eliminado', async () => {
    const chamadas: string[] = [];
    const eliminar = jest.fn(async (id: string) => {
      chamadas.push(id);
    });
    const find = jest
      .fn()
      .mockReturnValueOnce({
        select: () => ({
          limit: () => ({
            lean: async () => [
              {
                _id: 'antigo',
                alteradoEm: new Date('2020-01-01T00:00:00.000Z'),
                status: 'capturado',
              },
              {
                _id: 'revogado',
                alteradoEm: new Date('2026-09-01T00:00:00.000Z'),
                status: 'capturado',
                lgpd: { revogadoEm: new Date('2026-08-01T00:00:00.000Z') },
              },
              {
                _id: 'rascunho',
                alteradoEm: new Date('2025-01-01T00:00:00.000Z'),
                status: 'rascunho',
              },
              {
                _id: 'recente',
                alteradoEm: new Date('2026-08-01T00:00:00.000Z'),
                status: 'capturado',
              },
            ],
          }),
        }),
      })
      .mockReturnValueOnce({
        select: () => ({
          limit: () => ({ lean: async () => [{ _id: 'ja-eliminado' }] }),
        }),
      });
    const deleteMany = jest.fn(async () => undefined);
    const servico = new ExpurgoService({ find, deleteMany } as never, { eliminar } as never);
    const agora = new Date('2026-09-26T00:00:00.000Z');
    await expect(servico.rodar(agora)).resolves.toEqual({
      inatividade: 1,
      revogacao: 1,
      rascunhos: 1,
      removidos: 1,
    });
    expect(chamadas).toEqual(['antigo', 'revogado', 'rascunho']);
    expect(deleteMany).toHaveBeenCalled();
  });
});
