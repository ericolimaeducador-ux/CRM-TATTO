import { basenameDe, hospedagemPublica, urlDoAplicativo } from './base-publica';

describe('endereço público', () => {
  it('monta o QR no subcaminho do Pages', () => {
    expect(basenameDe('/')).toBeUndefined();
    expect(basenameDe('/CRM-TATTO/')).toBe('/CRM-TATTO');
    expect(urlDoAplicativo('/p/abc', '/CRM-TATTO/', 'https://ericolimaeducador-ux.github.io')).toBe(
      'https://ericolimaeducador-ux.github.io/CRM-TATTO/p/abc',
    );
  });

  it('trata o computador local como rede privada', () => {
    expect(hospedagemPublica('localhost')).toBe(false);
    expect(hospedagemPublica('192.168.0.20')).toBe(false);
    expect(hospedagemPublica('ericolimaeducador-ux.github.io')).toBe(true);
  });
});
