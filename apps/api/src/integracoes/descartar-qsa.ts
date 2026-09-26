const PERMITIDAS = new Set([
  'razao_social',
  'nome_fantasia',
  'nome',
  'fantasia',
  'cep',
  'logradouro',
  'numero',
  'complemento',
  'bairro',
  'municipio',
  'localidade',
  'uf',
  'endereco',
  'descricao_tipo_de_logradouro',
  'descricao_porte',
  'porte',
  'descricao_situacao_cadastral',
  'situacao',
  'situacao_cadastral',
  'status',
]);

export function descartarQsa(payload: unknown): unknown {
  return limpar(payload);
}

export function payloadParaGuardar(payload: unknown): unknown {
  const limpo = descartarQsa(payload);
  if (!limpo || typeof limpo !== 'object' || Array.isArray(limpo)) return {};
  const saida: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(limpo)) {
    if (!PERMITIDAS.has(normalizar(chave))) continue;
    if (typeof valor === 'string' || typeof valor === 'number') saida[chave] = valor;
  }
  return saida;
}

export function dadoSemContatoDireto<T extends { email?: string; telefone?: string }>(
  dado: T | null,
): T | null {
  if (!dado) return null;
  return { ...dado, email: undefined, telefone: undefined };
}

function limpar(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map((item) => limpar(item));
  if (!valor || typeof valor !== 'object') return valor;
  const saida: Record<string, unknown> = {};
  for (const [chave, item] of Object.entries(valor)) {
    if (chaveBloqueada(chave)) continue;
    saida[chave] = limpar(item);
  }
  return saida;
}

function chaveBloqueada(chave: string): boolean {
  const normal = normalizar(chave);
  return normal.includes('qsa') || normal.includes('socio') || normal.includes('quadro');
}

function normalizar(chave: string): string {
  return chave.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}
