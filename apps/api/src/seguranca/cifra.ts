import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

export function cifrar(valor: string): string {
  const iv = randomBytes(12);
  const cifra = createCipheriv('aes-256-gcm', chaveCifra(), iv);
  const corpo = Buffer.concat([cifra.update(valor, 'utf8'), cifra.final()]);
  const tag = cifra.getAuthTag();
  return [iv, tag, corpo].map((parte) => parte.toString('base64url')).join('.');
}

export function decifrar(pacote: string): string {
  const partes = pacote.split('.');
  if (partes.length !== 3) {
    throw new Error('Pacote cifrado ilegível. Grave de novo a partir do valor original.');
  }
  const [iv, tag, corpo] = partes.map((parte) => Buffer.from(parte, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', chaveCifra(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(corpo), decipher.final()]).toString('utf8');
}

export function hmacDocumento(valor: string): string {
  return createHmac('sha256', pepper()).update(valor, 'utf8').digest('hex');
}

export function mascararCpf(digitos: string): string {
  if (digitos.length !== 11) return '***.***.***-**';
  return `***.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-**`;
}

export function mascararCnpj(digitos: string): string {
  if (digitos.length !== 14) return '**.***.***/****-**';
  return `**.${digitos.slice(2, 5)}.${digitos.slice(5, 8)}/${digitos.slice(8, 12)}-**`;
}

function chaveCifra(): Buffer {
  const bruto = process.env.CIFRA_CHAVE_BASE64;
  if (!bruto) {
    throw new Error('CIFRA_CHAVE_BASE64 ausente. Gere 32 bytes fora do repositório.');
  }
  const chave = Buffer.from(bruto, 'base64');
  if (chave.length !== 32) {
    throw new Error('CIFRA_CHAVE_BASE64 precisa decodificar para 32 bytes.');
  }
  return chave;
}

function pepper(): string {
  const valor = process.env.CIFRA_PEPPER?.trim() ?? '';
  if (!valor || /preencha/i.test(valor) || valor.length < 32) {
    throw new Error(
      'CIFRA_PEPPER ausente, placeholder ou curto demais. Gere pelo menos 32 caracteres fora do repositório.',
    );
  }
  return valor;
}
