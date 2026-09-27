import { confirmacaoConfere } from './confirmacao-nome';

describe('confirmação do nome', () => {
  it('ignora maiúsculas e acentos e aceita a palavra eliminar', () => {
    expect(confirmacaoConfere('Érico', 'erico')).toBe(true);
    expect(confirmacaoConfere('  erico  ', 'Érico')).toBe(true);
    expect(confirmacaoConfere('eliminar', 'Outro Nome')).toBe(true);
    expect(confirmacaoConfere('ELIMINAR', 'Outro Nome')).toBe(true);
    expect(confirmacaoConfere('erica', 'Érico')).toBe(false);
    expect(confirmacaoConfere('', 'Érico')).toBe(false);
  });
});
