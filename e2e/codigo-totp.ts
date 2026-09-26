import { createHmac } from 'node:crypto';

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function codigoTotp(segredo: string, agoraMs = Date.now()): string {
  const passo = Math.floor(agoraMs / 1000 / 30);
  const mensagem = Buffer.alloc(8);
  mensagem.writeBigUInt64BE(BigInt(passo));
  const mac = createHmac('sha1', decodificarBase32(segredo)).update(mensagem).digest();
  const deslocamento = (mac[mac.length - 1] ?? 0) & 0x0f;
  const binario =
    ((mac[deslocamento] & 0x7f) << 24) |
    (mac[deslocamento + 1] << 16) |
    (mac[deslocamento + 2] << 8) |
    mac[deslocamento + 3];
  return (binario % 1_000_000).toString().padStart(6, '0');
}

function decodificarBase32(texto: string): Buffer {
  let bits = '';
  for (const char of texto.toUpperCase().replace(/=+$/g, '')) {
    const indice = ALFABETO.indexOf(char);
    if (indice < 0) continue;
    bits += indice.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}
