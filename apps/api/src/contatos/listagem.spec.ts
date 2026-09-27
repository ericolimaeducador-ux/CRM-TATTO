import {
  completarFiltro,
  inicioDaSemanaEmSaoPaulo,
  inicioDoDiaEmSaoPaulo,
  semSegredoDeDocumento,
} from './listagem';

describe('listagem de cadastros', () => {
  it('ignora filtro inválido e aceita status conhecido', () => {
    const filtro: Record<string, unknown> = {};
    const { ordem } = completarFiltro(filtro, { status: 'sumiu', origem: 'manual', pessoa: 'PF' });
    expect(filtro.status).toBeUndefined();
    expect(filtro['origem.modo']).toBe('manual');
    expect(filtro.tipoPessoa).toBe('PF');
    expect(ordem).toBe('recente');
  });

  it('tira o documento cifrado da lista e deixa a máscara', () => {
    const vista = semSegredoDeDocumento({
      nome: 'Ana',
      pf: { cpfCifrado: 'segredo', cpfHash: 'hash', cpfMascarado: '***.982.247-**' },
      pj: { cnpjCifrado: 'segredo', cnpjHash: 'hash', cnpjMascarado: '**.222.333/0001-**' },
    });
    expect(JSON.stringify(vista)).not.toContain('segredo');
    expect(JSON.stringify(vista)).not.toContain('hash');
    expect((vista.pf as { cpfMascarado: string }).cpfMascarado).toBe('***.982.247-**');
    expect((vista.pj as { cnpjMascarado: string }).cnpjMascarado).toBe('**.222.333/0001-**');
  });

  it('conta o dia e a semana no fuso de São Paulo', () => {
    const domingo = new Date('2026-09-27T15:00:00.000Z');
    expect(inicioDoDiaEmSaoPaulo(domingo).toISOString()).toBe('2026-09-27T03:00:00.000Z');
    expect(inicioDaSemanaEmSaoPaulo(domingo).toISOString()).toBe('2026-09-21T03:00:00.000Z');
  });
});
