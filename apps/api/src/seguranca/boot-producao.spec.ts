import { randomBytes } from 'node:crypto';
import { exigirSegredosDeProducao, portaDe } from './boot-producao';

describe('boot de produção', () => {
  it('recusa produção sem chave e pepper e não gera substituto', () => {
    expect(() => exigirSegredosDeProducao({ NODE_ENV: 'production' })).toThrow(/não gera chave/);
    expect(() =>
      exigirSegredosDeProducao({
        NODE_ENV: 'production',
        CIFRA_CHAVE_BASE64: randomBytes(16).toString('base64'),
        CIFRA_PEPPER: 'curto',
      }),
    ).toThrow(/Secret Manager/);
    expect(() =>
      exigirSegredosDeProducao({
        NODE_ENV: 'production',
        CIFRA_CHAVE_BASE64: randomBytes(32).toString('base64'),
        CIFRA_PEPPER: 'preencha-com-um-pepper-longo-o-bastante',
      }),
    ).toThrow(/não gera chave/);
  });

  it('aceita produção com os dois segredos e ignora development', () => {
    expect(() => exigirSegredosDeProducao({ NODE_ENV: 'development' })).not.toThrow();
    expect(() =>
      exigirSegredosDeProducao({
        NODE_ENV: 'production',
        CIFRA_CHAVE_BASE64: randomBytes(32).toString('base64'),
        CIFRA_PEPPER: randomBytes(32).toString('base64'),
      }),
    ).not.toThrow();
  });

  it('lê PORT e usa 3000 quando a variável falta', () => {
    expect(portaDe({})).toBe(3000);
    expect(portaDe({ PORT: '10000' })).toBe(10000);
    expect(portaDe({ PORT: '8080' })).toBe(8080);
    expect(portaDe({ PORT: 'abc' })).toBe(3000);
  });
});
