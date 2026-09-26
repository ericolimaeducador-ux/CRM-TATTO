import { lerCsv, matrizDoXlsx, paraCsv, paraXlsx } from './tabela';

describe('tabela csv e xlsx', () => {
  it('preserva vírgula e fórmula e reabre o xlsx', () => {
    const linhas = [
      ['nome', 'email'],
      ['Ana, Lima', '=1+1'],
    ];
    const csv = paraCsv(linhas);
    expect(csv).toContain('"Ana, Lima"');
    expect(csv).toContain("'=1+1");
    expect(lerCsv(csv)[1][0]).toBe('Ana, Lima');
    const lido = matrizDoXlsx(paraXlsx(linhas));
    expect(lido[0]).toEqual(['nome', 'email']);
    expect(lido[1][0]).toBe('Ana, Lima');
    expect(lido[1][1]).toBe('=1+1');
  });
});
