export const CAMPOS_MERGE = [
  'nome',
  'nomeSocial',
  'tipoPessoa',
  'observacoes',
  'emails',
  'telefones',
  'enderecos',
  'pj.razaoSocial',
  'pj.nomeFantasia',
] as const;

export type CampoMerge = (typeof CAMPOS_MERGE)[number];

export const PRAZO_RECUPERACAO_MS = 90 * 24 * 60 * 60 * 1000;

export function prazoExpirado(quando: Date, agora: Date): boolean {
  return agora.getTime() - quando.getTime() > PRAZO_RECUPERACAO_MS;
}

interface DocCampo {
  get(caminho: string): unknown;
  set(caminho: string, valor: unknown): unknown;
  markModified(caminho: string): void;
}

export function copiarCampo(destino: DocCampo, origem: DocCampo, campo: string): void {
  if (!campo.startsWith('pj.')) {
    destino.set(campo, origem.get(campo));
    destino.markModified(campo);
    return;
  }
  const filho = campo.slice(3);
  const pjDestino = objeto(destino.get('pj'));
  const pjOrigem = objeto(origem.get('pj'));
  pjDestino[filho] = pjOrigem[filho];
  destino.set('pj', pjDestino);
  destino.markModified('pj');
}

function objeto(valor: unknown): Record<string, unknown> {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return {};
  return { ...(valor as Record<string, unknown>) };
}
