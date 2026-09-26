import { randomBytes, randomInt } from 'node:crypto';

interface Desafio {
  resposta: string;
  expira: number;
}

const desafios = new Map<string, Desafio>();

export function zerarDesafios(): void {
  desafios.clear();
}

export function descreverCaptcha(): {
  provedor: string;
  id?: string;
  pergunta?: string;
  sitekey?: string;
} {
  const provedor = (process.env.CAPTCHA_PROVEDOR ?? 'local').trim().toLowerCase();
  if (provedor === 'hcaptcha' || provedor === 'turnstile') {
    const bruto =
      provedor === 'hcaptcha' ? process.env.HCAPTCHA_SITEKEY : process.env.TURNSTILE_SITEKEY;
    const sitekey = bruto?.trim() && !/preencha/i.test(bruto) ? bruto.trim() : '';
    return { provedor, sitekey };
  }
  const local = emitirDesafioLocal();
  return { provedor: 'local', id: local.id, pergunta: local.pergunta };
}

export function emitirDesafioLocal(agora = Date.now()): { id: string; pergunta: string } {
  const a = randomInt(2, 10);
  const b = randomInt(2, 10);
  const id = randomBytes(16).toString('hex');
  desafios.set(id, { resposta: String(a + b), expira: agora + 5 * 60_000 });
  return { id, pergunta: `Quanto é ${a} + ${b}?` };
}

export function conferirDesafioLocal(id: string, resposta: string, agora = Date.now()): boolean {
  const item = desafios.get(id);
  desafios.delete(id);
  if (!item || item.expira < agora) return false;
  return item.resposta === resposta.trim();
}

export async function conferirCaptcha(corpo: {
  captchaId?: string;
  captchaResposta?: string;
  captchaToken?: string;
}): Promise<'ok' | 'invalido' | 'nao_configurado'> {
  const provedor = (process.env.CAPTCHA_PROVEDOR ?? 'local').trim().toLowerCase();
  if (!provedor || provedor === 'local') {
    return conferirDesafioLocal(corpo.captchaId ?? '', corpo.captchaResposta ?? '')
      ? 'ok'
      : 'invalido';
  }
  if (provedor !== 'hcaptcha' && provedor !== 'turnstile') return 'nao_configurado';
  const segredo =
    provedor === 'hcaptcha' ? process.env.HCAPTCHA_SEGREDO : process.env.TURNSTILE_SEGREDO;
  if (!segredo?.trim() || /preencha/i.test(segredo)) return 'nao_configurado';
  const token = corpo.captchaToken?.trim() || corpo.captchaResposta?.trim() || '';
  if (!token) return 'invalido';
  const url =
    provedor === 'hcaptcha'
      ? 'https://hcaptcha.com/siteverify'
      : 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
  const resposta = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret: segredo, response: token }),
  });
  const json = (await resposta.json()) as { success?: boolean };
  return json.success ? 'ok' : 'invalido';
}
