export function saltosDeProxyConfiavel(
  bruto = process.env.CAPTURA7_TRUST_PROXY_SALTOS,
): number | null {
  if (!bruto) return null;
  if (!/^[1-9]\d*$/.test(bruto) || Number(bruto) > 5) {
    throw new Error(
      'CAPTURA7_TRUST_PROXY_SALTOS precisa ser um inteiro de 1 a 5. true não é aceito.',
    );
  }
  return Number(bruto);
}
