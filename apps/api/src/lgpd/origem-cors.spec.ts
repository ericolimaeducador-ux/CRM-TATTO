import { opcoesDeCors, origemDeRedeLocal, origemPermitida } from './origem-cors';

describe('origem de rede local', () => {
  it('aceita o computador e a rede da casa', () => {
    expect(origemDeRedeLocal(undefined)).toBe(true);
    expect(origemDeRedeLocal('http://localhost:5173')).toBe(true);
    expect(origemDeRedeLocal('https://192.168.0.20')).toBe(true);
    expect(origemDeRedeLocal('http://10.0.0.8:5173')).toBe(true);
    expect(origemDeRedeLocal('https://172.16.1.4')).toBe(true);
  });

  it('aceita origem extra configurada e recusa o resto', () => {
    process.env.CORS_ORIGENS = 'https://captura7.web.app';
    expect(origemPermitida('https://captura7.web.app')).toBe(true);
    expect(origemPermitida('https://outro.example')).toBe(false);
    delete process.env.CORS_ORIGENS;
  });

  it('libera o Firebase só quando cada origem está na lista', () => {
    process.env.CORS_ORIGENS = 'https://captura7.web.app,https://captura7.firebaseapp.com';
    expect(origemPermitida('https://captura7.web.app')).toBe(true);
    expect(origemPermitida('https://captura7.firebaseapp.com')).toBe(true);
    expect(origemPermitida('https://outro.web.app')).toBe(false);
    expect(origemPermitida('https://captura7-api.onrender.com')).toBe(false);
    expect(origemPermitida('https://captura7.web.app.evil.example')).toBe(false);
    delete process.env.CORS_ORIGENS;
    expect(origemPermitida('https://captura7.web.app')).toBe(false);
    expect(origemPermitida('https://captura7.firebaseapp.com')).toBe(false);
  });

  it('manda o token no Authorization e não pede cookie entre sites', () => {
    const opcoes = opcoesDeCors();
    expect(opcoes.credentials).toBe(false);
    expect(opcoes.allowedHeaders).toContain('Authorization');
    expect(opcoes.allowedHeaders).toEqual(['Content-Type', 'Authorization']);
  });

  it('recusa endereço público', () => {
    expect(origemDeRedeLocal('https://exemplo.com')).toBe(false);
    expect(origemDeRedeLocal('http://172.15.0.1')).toBe(false);
    expect(origemDeRedeLocal('nao-e-url')).toBe(false);
  });
});
