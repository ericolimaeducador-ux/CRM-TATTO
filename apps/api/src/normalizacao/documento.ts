export function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

export function cpfValido(valor: string): boolean {
  const digitos = apenasDigitos(valor);
  if (digitos.length !== 11 || /^(\d)\1{10}$/.test(digitos)) return false;
  const nums = digitos.split('').map(Number);
  return digitoCpf(nums, 10) === nums[9] && digitoCpf(nums, 11) === nums[10];
}

export function cnpjValido(valor: string): boolean {
  const digitos = apenasDigitos(valor);
  if (digitos.length !== 14 || /^(\d)\1{13}$/.test(digitos)) return false;
  const nums = digitos.split('').map(Number);
  const primeiro = digitoCnpj(nums, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const segundo = digitoCnpj(nums, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return primeiro === nums[12] && segundo === nums[13];
}

function digitoCpf(nums: number[], fator: number): number {
  let soma = 0;
  for (let i = 0; i < fator - 1; i += 1) soma += (nums[i] ?? 0) * (fator - i);
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}

function digitoCnpj(nums: number[], pesos: number[]): number {
  const soma = pesos.reduce((acc, peso, indice) => acc + (nums[indice] ?? 0) * peso, 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}
