export function confirmacaoConfere(confirmacao: string, nome: unknown): boolean {
  const texto = dobrar(confirmacao);
  if (texto === 'eliminar') return true;
  const atual = typeof nome === 'string' ? dobrar(nome) : '';
  return atual !== '' && texto === atual;
}

function dobrar(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
