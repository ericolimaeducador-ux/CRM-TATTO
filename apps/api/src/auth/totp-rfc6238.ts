import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** Passo de 30s, 6 dígitos, janela ±1. RFC 6238, HMAC-SHA1. */
export const PASSO_TOTP_SEGUNDOS = 30;
export const DIGITOS_TOTP = 6;
export const JANELA_TOTP_PASSOS = 1;

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function gerarSegredoBase32(): string {
  return codificarBase32(randomBytes(20));
}

export function hotp(chave: Buffer, contador: number, digitos = DIGITOS_TOTP): string {
  const mensagem = Buffer.alloc(8);
  mensagem.writeBigUInt64BE(BigInt(contador));
  const mac = createHmac('sha1', chave).update(mensagem).digest();
  const deslocamento = mac[mac.length - 1] & 0x0f;
  const binario =
    ((mac[deslocamento] & 0x7f) << 24) |
    (mac[deslocamento + 1] << 16) |
    (mac[deslocamento + 2] << 8) |
    mac[deslocamento + 3];
  return (binario % 10 ** digitos).toString().padStart(digitos, '0');
}

export function passoAtual(agoraMs = Date.now()): number {
  return Math.floor(agoraMs / 1000 / PASSO_TOTP_SEGUNDOS);
}

export function codigoNoPasso(segredoBase32: string, passo: number): string {
  return hotp(decodificarBase32(segredoBase32), passo, DIGITOS_TOTP);
}

export function passosNaJanela(agoraMs = Date.now()): number[] {
  const atual = passoAtual(agoraMs);
  const passos: number[] = [];
  for (let delta = -JANELA_TOTP_PASSOS; delta <= JANELA_TOTP_PASSOS; delta += 1) {
    passos.push(atual + delta);
  }
  return passos;
}

export function codigosCoincidem(informado: string, esperado: string): boolean {
  if (informado.length !== esperado.length) return false;
  return timingSafeEqual(Buffer.from(informado), Buffer.from(esperado));
}

export function codificarBase32(bruto: Buffer): string {
  let bits = '';
  for (const byte of bruto) bits += byte.toString(2).padStart(8, '0');
  let saida = '';
  for (let i = 0; i < bits.length; i += 5) {
    const fatia = bits.slice(i, i + 5).padEnd(5, '0');
    saida += ALFABETO[Number.parseInt(fatia, 2)];
  }
  return saida;
}

export function decodificarBase32(texto: string): Buffer {
  const limpo = texto.replace(/=+$/g, '').toUpperCase().replace(/\s/g, '');
  let bits = '';
  for (const caractere of limpo) {
    const indice = ALFABETO.indexOf(caractere);
    if (indice < 0) {
      throw new Error('Segredo TOTP ilegível.');
    }
    bits += indice.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}
