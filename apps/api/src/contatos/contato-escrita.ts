import { ErroNomeado } from './schemas/erro-nomeado';

export function semCaminhosPontilhados(doc: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(doc).filter(([chave]) => !chave.includes('.')));
}

export function plano(valor: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(valor ?? {})) as Record<string, unknown>;
}

export function idDoVendedor(doc: Record<string, unknown>): string | undefined {
  const origem = doc.origem as { vendedorAtribuido?: unknown } | undefined;
  if (!origem?.vendedorAtribuido) return undefined;
  return String(origem.vendedorAtribuido);
}

export function ehIdLocalDuplicado(erro: unknown): boolean {
  return codigoMongo(erro) === 11000 && JSON.stringify(erro).includes('idLocal');
}

export function ehDuplicidadeDocumento(erro: unknown): boolean {
  if (codigoMongo(erro) !== 11000) return false;
  const texto = JSON.stringify(erro);
  return texto.includes('cpfHash') || texto.includes('cnpjHash');
}

export function duplicidadeNomeada(erro: unknown): ErroNomeado | undefined {
  const texto = JSON.stringify(erro);
  if (texto.includes('cnpjHash')) {
    return new ErroNomeado(
      'CNPJ_DUPLICADO',
      'Já existe um contato fora de rascunho com este CNPJ. Abra a duplicata e peça a um gestor para decidir. Este registro permanece no status anterior.',
    );
  }
  if (texto.includes('cpfHash')) {
    return new ErroNomeado(
      'CPF_DUPLICADO',
      'Já existe um contato fora de rascunho com este CPF. Abra a duplicata e peça a um gestor para decidir. Este registro permanece no status anterior.',
    );
  }
  return undefined;
}

export function textoDeBusca(q: string | undefined): RegExp | undefined {
  const limpo = q?.trim().slice(0, 80) ?? '';
  if (!limpo) return undefined;
  return new RegExp(limpo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

function codigoMongo(erro: unknown): number | undefined {
  if (!erro || typeof erro !== 'object' || !('code' in erro)) return undefined;
  return typeof erro.code === 'number' ? erro.code : undefined;
}
