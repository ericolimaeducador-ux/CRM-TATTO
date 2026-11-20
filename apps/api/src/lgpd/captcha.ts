import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/**
 * Desafio local "Quanto é a + b?".
 *
 * O desafio não fica guardado na memória do processo: o id carrega o prazo, um nonce e uma
 * assinatura HMAC da resposta certa. Assim ele sobrevive a reinício, sono do Render Free e a
 * mais de uma instância. A memória guarda só os nonces já gastos, para não aceitar o mesmo
 * desafio duas vezes (e não permitir tentar todas as somas com o mesmo id).
 */
const PRAZO_DESAFIO_MS = 30 * 60_000;

const gastos = new Map<string, number>();
let chaveDoProcesso: Buffer | null = null;

export function zerarDesafios(): void {
  gastos.clear();
}

export function prazoDoDesafioMs(): number {
  return PRAZO_DESAFIO_MS;
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
  const expira = agora + PRAZO_DESAFIO_MS;
  const nonce = randomBytes(12).toString('hex');
  const id = `${expira.toString(36)}.${nonce}.${assinar(expira, nonce, String(a + b))}`;
  return { id, pergunta: `Quanto é ${a} + ${b}?` };
}

export function conferirDesafioLocal(id: string, resposta: string, agora = Date.now()): boolean {
  limparGastos(agora);
  const partes = id.trim().split('.');
  if (partes.length !== 3) return false;
  const [prazoBruto, nonce, assinatura] = partes as [string, string, string];
  const expira = parseInt(prazoBruto, 36);
  if (!Number.isFinite(expira) || !/^[0-9a-f]{24}$/.test(nonce)) return false;
  if (expira < agora || expira > agora + PRAZO_DESAFIO_MS) return false;
  if (gastos.has(nonce)) return false;
  // Qualquer tentativa gasta o desafio, certa ou errada: não dá para chutar as somas.
  gastos.set(nonce, expira);
  const normalizada = normalizarResposta(resposta);
  if (!normalizada) return false;
  const esperada = Buffer.from(assinar(expira, nonce, normalizada));
  const recebida = Buffer.from(assinatura);
  return esperada.length === recebida.length && timingSafeEqual(esperada, recebida);
}

/** Aceita " 12 ", "１２" (teclado de largura cheia) e "12." — sobram só os dígitos. */
export function normalizarResposta(resposta: string): string {
  return resposta
    .normalize('NFKC')
    .replace(/\D/g, '')
    .replace(/^0+(?=\d)/, '');
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

function assinar(expira: number, nonce: string, resposta: string): string {
  return createHmac('sha256', chaveDoDesafio())
    .update(`desafio-local.v1.${expira}.${nonce}.${resposta}`)
    .digest('base64url');
}

/**
 * Deriva a chave do CIFRA_PEPPER, que já é fixo no Render (o boot de produção exige). Sem ele
 * (dev e testes) usa uma chave aleatória do processo.
 */
function chaveDoDesafio(): Buffer {
  const pepper = process.env.CIFRA_PEPPER?.trim() ?? '';
  if (pepper.length >= 32 && !/preencha/i.test(pepper)) {
    return createHmac('sha256', pepper).update('captcha-desafio-local').digest();
  }
  chaveDoProcesso ??= randomBytes(32);
  return chaveDoProcesso;
}

function limparGastos(agora: number): void {
  for (const [nonce, expira] of gastos) {
    if (expira < agora) gastos.delete(nonce);
  }
}
