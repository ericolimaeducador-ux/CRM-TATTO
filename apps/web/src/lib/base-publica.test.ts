import { basenameDe, hospedagemPublica, urlDoAplicativo } from './base-publica';

describe('endereço público', () => {
  it('monta o QR na raiz do Firebase', () => {
    expect(basenameDe('/')).toBeUndefined();
    expect(urlDoAplicativo('/p/abc', '/', 'https://captura7-5e1da.web.app')).toBe(
      'https://captura7-5e1da.web.app/p/abc',
    );
  });

  it('trata o computador local como rede privada', () => {
    expect(hospedagemPublica('localhost')).toBe(false);
    expect(hospedagemPublica('192.168.0.20')).toBe(false);
    expect(hospedagemPublica('captura7-5e1da.web.app')).toBe(true);
    expect(hospedagemPublica('captura7-5e1da.firebaseapp.com')).toBe(true);
  });
});
