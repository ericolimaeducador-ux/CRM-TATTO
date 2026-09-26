import { calcularCompletude, enderecoCompleto, type EnderecoMinimo } from '../qualidade/completude';

export function aplicarCompletude(doc: Record<string, unknown>, documentoValido: boolean): void {
  const telefones = (doc.telefones as { e164?: string }[] | undefined) ?? [];
  const emails = (doc.emails as { valor?: string }[] | undefined) ?? [];
  const enderecos = (doc.enderecos as EnderecoMinimo[] | undefined) ?? [];
  const pj = (doc.pj as { razaoSocial?: string; nomeFantasia?: string } | undefined) ?? {};
  const pf = (doc.pf as { profissao?: string } | undefined) ?? {};
  const resultado = calcularCompletude({
    nome: typeof doc.nome === 'string' ? doc.nome : undefined,
    documentoValido,
    telefone: telefones.some((item) => Boolean(item.e164)),
    email: emails.some((item) => typeof item.valor === 'string' && item.valor.includes('@')),
    enderecoCompleto: enderecos.some((item) => enderecoCompleto(item)),
    tipoPessoa: doc.tipoPessoa as 'PF' | 'PJ' | 'INDEFINIDO' | undefined,
    campoEspecifico: Boolean(pj.razaoSocial || pj.nomeFantasia || pf.profissao),
    status: doc.status as
      'rascunho' | 'capturado' | 'qualificado' | 'cliente' | 'descartado' | undefined,
  });
  doc.status = resultado.status;
  doc.completude = {
    score: resultado.score,
    camposFaltantes: resultado.camposFaltantes,
    calculadoEm: new Date(),
  };
}

export function vistaComSet(
  antes: Record<string, unknown>,
  set: Record<string, unknown>,
): Record<string, unknown> {
  const copia = JSON.parse(JSON.stringify(antes)) as Record<string, unknown>;
  for (const [chave, valor] of Object.entries(set)) {
    if (!chave.includes('.')) {
      copia[chave] = valor;
      continue;
    }
    const [pai, filho] = chave.split('.') as [string, string];
    const atual = copia[pai] && typeof copia[pai] === 'object' ? { ...(copia[pai] as object) } : {};
    (atual as Record<string, unknown>)[filho] = valor;
    copia[pai] = atual;
  }
  return copia;
}
