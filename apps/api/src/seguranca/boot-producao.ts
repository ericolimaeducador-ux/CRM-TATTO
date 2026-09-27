export function exigirSegredosDeProducao(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== 'production') return;
  const pepper = (env.CIFRA_PEPPER ?? '').trim();
  const chave = Buffer.from(env.CIFRA_CHAVE_BASE64 ?? '', 'base64');
  const pepperRuim = !pepper || /preencha/i.test(pepper) || pepper.length < 32;
  if (pepperRuim || chave.length !== 32) {
    throw new Error(
      'Em produção a API não gera chave nem pepper. Defina CIFRA_CHAVE_BASE64 (32 bytes em base64) e CIFRA_PEPPER (32 caracteres ou mais) no Secret Manager do Cloud Run. Sem esses valores fixos, um segredo novo a cada reinício tornaria os documentos cifrados ilegíveis. Nada foi gerado.',
    );
  }
}

export function portaDe(env: NodeJS.ProcessEnv = process.env): number {
  const porta = Number(env.PORT ?? 3000);
  if (!Number.isInteger(porta) || porta < 1 || porta > 65535) return 3000;
  return porta;
}
