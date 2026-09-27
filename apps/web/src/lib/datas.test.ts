import { dataBr, dataHoraBr, isoDeBr, mascararData } from './datas';

describe('datas brasileiras', () => {
  it('mostra o dia em São Paulo e recusa calendário inválido', () => {
    expect(dataBr('2026-09-27T15:00:00.000Z')).toBe('27/09/2026');
    expect(dataHoraBr('2026-09-27T15:00:00.000Z').replace(/\s/g, ' ')).toContain('27/09/2026');
    expect(dataHoraBr('2026-09-27T15:00:00.000Z')).toContain('12:00');
    expect(mascararData('27092026')).toBe('27/09/2026');
    expect(isoDeBr('27/09/2026')).toBe('2026-09-27');
    expect(isoDeBr('31/02/2026')).toBe('');
    expect(isoDeBr('09/27/2026')).toBe('');
  });
});
