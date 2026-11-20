import {
  conferirCaptcha,
  conferirDesafioLocal,
  descreverCaptcha,
  emitirDesafioLocal,
  normalizarResposta,
  zerarDesafios,
} from './captcha';

function somaDe(pergunta: string): string {
  const numeros = pergunta.match(/\d+/g)?.map(Number) ?? [];
  return String((numeros[0] ?? 0) + (numeros[1] ?? 0));
}

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

  it('continua valendo depois de a memória do processo sumir (reinício ou sono do Render)', () => {
    const desafio = emitirDesafioLocal();
    zerarDesafios();
    expect(conferirDesafioLocal(desafio.id, somaDe(desafio.pergunta))).toBe(true);
  });

  it('vale meia hora, e não mais', () => {
    const agora = Date.now();
    const desafio = emitirDesafioLocal(agora);
    const soma = somaDe(desafio.pergunta);
    expect(conferirDesafioLocal(desafio.id, soma, agora + 25 * 60_000)).toBe(true);
    const outro = emitirDesafioLocal(agora);
    expect(conferirDesafioLocal(outro.id, somaDe(outro.pergunta), agora + 31 * 60_000)).toBe(false);
  });

  it('gasta o desafio na resposta errada: não dá para chutar todas as somas', () => {
    const desafio = emitirDesafioLocal();
    expect(conferirDesafioLocal(desafio.id, '999')).toBe(false);
    expect(conferirDesafioLocal(desafio.id, somaDe(desafio.pergunta))).toBe(false);
  });

  it('aceita espaços, dígitos de largura cheia e zero à esquerda', () => {
    expect(normalizarResposta(' 12 ')).toBe('12');
    expect(normalizarResposta('１２')).toBe('12');
    expect(normalizarResposta('012')).toBe('12');
    expect(normalizarResposta('Erico')).toBe('');
    const desafio = emitirDesafioLocal();
    const soma = somaDe(desafio.pergunta);
    const largo = soma.replace(/\d/g, (d) => String.fromCharCode(0xff10 + Number(d)));
    expect(conferirDesafioLocal(desafio.id, ` ${largo} `)).toBe(true);
  });

  it('recusa id adulterado ou assinado com outra resposta', () => {
    const desafio = emitirDesafioLocal();
    const [prazo, nonce] = desafio.id.split('.');
    expect(
      conferirDesafioLocal(`${prazo}.${nonce}.assinatura-falsa`, somaDe(desafio.pergunta)),
    ).toBe(false);
    expect(conferirDesafioLocal('lixo', '4')).toBe(false);
    const longe = (Date.now() + 10 * 60 * 60_000).toString(36);
    const outro = emitirDesafioLocal();
    const [, nonce2, assinatura2] = outro.id.split('.');
    expect(conferirDesafioLocal(`${longe}.${nonce2}.${assinatura2}`, somaDe(outro.pergunta))).toBe(
      false,
    );
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
