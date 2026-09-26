import { hotp } from './totp-rfc6238';

const SEMENTE = Buffer.from('12345678901234567890', 'ascii');

describe('RFC 6238', () => {
  it('reproduz os vetores SHA1 de 8 dígitos', () => {
    const vetores: Array<[number, string]> = [
      [59, '94287082'],
      [1111111109, '07081804'],
      [1111111111, '14050471'],
      [1234567890, '89005924'],
      [2000000000, '69279037'],
      [20000000000, '65353130'],
    ];
    for (const [instante, esperado] of vetores) {
      const contador = Math.floor(instante / 30);
      expect(hotp(SEMENTE, contador, 8)).toBe(esperado);
    }
  });
});
