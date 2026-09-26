import {
  conferirCaptcha,
  conferirDesafioLocal,
  emitirDesafioLocal,
  zerarDesafios,
} from './captcha';

describe('captcha local', () => {
  afterEach(() => {
    zerarDesafios();
    delete process.env.CAPTCHA_PROVEDOR;
    delete process.env.HCAPTCHA_SEGREDO;
  });

  it('aceita a soma uma vez e recusa de novo', () => {
    const desafio = emitirDesafioLocal();
    const numeros = desafio.pergunta.match(/\d+/g)?.map(Number) ?? [];
    const soma = String((numeros[0] ?? 0) + (numeros[1] ?? 0));
    expect(conferirDesafioLocal(desafio.id, soma)).toBe(true);
    expect(conferirDesafioLocal(desafio.id, soma)).toBe(false);
  });

  it('não finge hCaptcha sem segredo', async () => {
    process.env.CAPTCHA_PROVEDOR = 'hcaptcha';
    await expect(conferirCaptcha({ captchaToken: 'token' })).resolves.toBe('nao_configurado');
  });
});
