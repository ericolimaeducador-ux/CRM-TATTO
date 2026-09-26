import {
  conferirCaptcha,
  conferirDesafioLocal,
  descreverCaptcha,
  emitirDesafioLocal,
  zerarDesafios,
} from './captcha';

describe('captcha local', () => {
  afterEach(() => {
    zerarDesafios();
    delete process.env.CAPTCHA_PROVEDOR;
    delete process.env.HCAPTCHA_SEGREDO;
    delete process.env.TURNSTILE_SITEKEY;
  });

  it('aceita a soma uma vez e recusa de novo', () => {
    const desafio = emitirDesafioLocal();
    const numeros = desafio.pergunta.match(/\d+/g)?.map(Number) ?? [];
    const soma = String((numeros[0] ?? 0) + (numeros[1] ?? 0));
    expect(conferirDesafioLocal(desafio.id, soma)).toBe(true);
    expect(conferirDesafioLocal(desafio.id, soma)).toBe(false);
  });

  it('descreve a soma local e a chave pública quando o provedor muda', () => {
    const local = descreverCaptcha();
    expect(local.provedor).toBe('local');
    expect(local.pergunta).toContain('Quanto é');
    process.env.CAPTCHA_PROVEDOR = 'turnstile';
    process.env.TURNSTILE_SITEKEY = 'chave-publica';
    expect(descreverCaptcha()).toEqual({ provedor: 'turnstile', sitekey: 'chave-publica' });
  });

  it('não finge hCaptcha sem segredo', async () => {
    process.env.CAPTCHA_PROVEDOR = 'hcaptcha';
    await expect(conferirCaptcha({ captchaToken: 'token' })).resolves.toBe('nao_configurado');
  });
});
