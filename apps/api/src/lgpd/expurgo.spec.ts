import { ExpurgoService } from './expurgo.service';

describe('expurgo por inatividade', () => {
  it('elimina só o cadastro parado além do prazo', async () => {
    const chamadas: string[] = [];
    const eliminar = jest.fn(async (id: string) => {
      chamadas.push(id);
    });
    const find = jest.fn().mockReturnValue({
      select: () => ({
        limit: () => ({
          lean: async () => [
            { _id: 'antigo', alteradoEm: new Date('2020-01-01T00:00:00.000Z') },
            { _id: 'recente', alteradoEm: new Date('2026-08-01T00:00:00.000Z') },
          ],
        }),
      }),
    });
    const servico = new ExpurgoService({ find } as never, { eliminar } as never);
    const agora = new Date('2026-09-26T00:00:00.000Z');
    await expect(servico.rodar(agora)).resolves.toBe(1);
    expect(chamadas).toEqual(['antigo']);
  });
});
