import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb);

export async function hashSenha(senha: string): Promise<string> {
  if (senha.trim().length < 12) {
    throw new Error('A senha precisa de pelo menos 12 caracteres.');
  }
  const salt = randomBytes(16);
  const hash = (await scrypt(senha, salt, 32)) as Buffer;
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export async function senhaConfere(senha: string, gravada: string): Promise<boolean> {
  const [algo, salt, hash] = gravada.split('$');
  if (algo !== 'scrypt' || !salt || !hash) return false;
  const calculado = (await scrypt(senha, Buffer.from(salt, 'base64url'), 32)) as Buffer;
  const esperado = Buffer.from(hash, 'base64url');
  if (calculado.length !== esperado.length) return false;
  return timingSafeEqual(calculado, esperado);
}
