import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { carregarEnv } from './carregar-env';

describe('carregar .env', () => {
  const chaves = ['CAPTURA7_ENV_TESTE', 'CAPTURA7_ENV_JA', 'CAPTURA7_ENV_RAIZ'];

  afterEach(() => {
    for (const chave of chaves) delete process.env[chave];
  });

  it('lê o arquivo, não cobre o ambiente e não escreve no log', () => {
    const pasta = mkdtempSync(join(tmpdir(), 'captura7-env-'));
    writeFileSync(pasta + '/.env', 'CAPTURA7_ENV_TESTE=arquivo\nCAPTURA7_ENV_JA=arquivo\n# nota\n');
    process.env.CAPTURA7_ENV_JA = 'processo';
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    carregarEnv(pasta);
    expect(process.env.CAPTURA7_ENV_TESTE).toBe('arquivo');
    expect(process.env.CAPTURA7_ENV_JA).toBe('processo');
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it('lê o .env da pasta e o da raiz, e a pasta mais próxima prevalece', () => {
    const raiz = mkdtempSync(join(tmpdir(), 'captura7-dois-'));
    const aninhada = join(raiz, 'apps', 'api');
    mkdirSync(aninhada, { recursive: true });
    writeFileSync(join(aninhada, '.env'), 'CAPTURA7_ENV_TESTE=perto\n');
    writeFileSync(join(raiz, '.env'), 'CAPTURA7_ENV_TESTE=longe\nCAPTURA7_ENV_RAIZ=1\n');
    carregarEnv(aninhada);
    expect(process.env.CAPTURA7_ENV_TESTE).toBe('perto');
    expect(process.env.CAPTURA7_ENV_RAIZ).toBe('1');
  });

  it('sobe dois níveis quando o diretório atual não tem .env', () => {
    const raiz = mkdtempSync(join(tmpdir(), 'captura7-raiz-'));
    const aninhada = join(raiz, 'apps', 'api');
    mkdirSync(aninhada, { recursive: true });
    writeFileSync(join(raiz, '.env'), 'CAPTURA7_ENV_RAIZ=1\n');
    carregarEnv(aninhada);
    expect(process.env.CAPTURA7_ENV_RAIZ).toBe('1');
  });
});
