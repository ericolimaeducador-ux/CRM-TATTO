import { origemDeRedeLocal, origemPermitida } from './origem-cors';

describe('origem de rede local', () => {
  it('aceita o computador e a rede da casa', () => {
    expect(origemDeRedeLocal(undefined)).toBe(true);
    expect(origemDeRedeLocal('http://localhost:5173')).toBe(true);
    expect(origemDeRedeLocal('https://192.168.0.20')).toBe(true);
    expect(origemDeRedeLocal('http://10.0.0.8:5173')).toBe(true);
    expect(origemDeRedeLocal('https://172.16.1.4')).toBe(true);
  });

  it('aceita origem extra configurada e recusa o resto', () => {
    process.env.CORS_ORIGENS = 'https://erico.github.io';
    expect(origemPermitida('https://erico.github.io')).toBe(true);
    expect(origemPermitida('https://outro.example')).toBe(false);
    delete process.env.CORS_ORIGENS;
  });

  it('recusa endereço público', () => {
    expect(origemDeRedeLocal('https://exemplo.com')).toBe(false);
    expect(origemDeRedeLocal('http://172.15.0.1')).toBe(false);
    expect(origemDeRedeLocal('nao-e-url')).toBe(false);
  });
});
