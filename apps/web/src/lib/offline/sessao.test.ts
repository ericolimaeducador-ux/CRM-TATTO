import { codigoTotpDoCorpo } from './sessao';

describe('código TOTP no corpo', () => {
  it('omite o código no modo de teste e envia fora dele', () => {
    expect(codigoTotpDoCorpo('123456', true)).toBeUndefined();
    expect(codigoTotpDoCorpo('  ', false)).toBeUndefined();
    expect(codigoTotpDoCorpo('123456', false)).toBe('123456');
  });
});
