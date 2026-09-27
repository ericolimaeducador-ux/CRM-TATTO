import { randomInt } from 'node:crypto';

// Sem 0/O, 1/l/I: a senha é ditada ou copiada à mão pelo administrador.
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

/**
 * Senha provisória forte: 16 caracteres sorteados com `crypto.randomInt`
 * (cerca de 93 bits), em 4 blocos separados por hífen para ditar sem erro.
 * O hífen faz parte da senha.
 */
export function gerarSenhaProvisoria(): string {
  const blocos: string[] = [];
  for (let bloco = 0; bloco < 4; bloco += 1) {
    let texto = '';
    for (let i = 0; i < 4; i += 1) texto += ALFABETO[randomInt(ALFABETO.length)];
    blocos.push(texto);
  }
  return blocos.join('-');
}
