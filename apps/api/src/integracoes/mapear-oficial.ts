export interface DadoOficial {
  razaoSocial?: string;
  nomeFantasia?: string;
  email?: string;
  telefone?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cnaeDescricao?: string;
  porte?: 'MEI' | 'ME' | 'EPP' | 'DEMAIS';
  situacao?: string;
}

export function mapearBrasilApi(json: unknown): DadoOficial | null {
  const corpo = objeto(json);
  if (!corpo || typeof corpo.razao_social !== 'string') return null;
  return {
    razaoSocial: texto(corpo.razao_social),
    nomeFantasia: texto(corpo.nome_fantasia),
    email: texto(corpo.email),
    telefone: texto(corpo.ddd_telefone_1),
    cep: texto(corpo.cep),
    logradouro: texto(corpo.logradouro),
    numero: texto(corpo.numero),
    complemento: texto(corpo.complemento),
    bairro: texto(corpo.bairro),
    cidade: texto(corpo.municipio),
    uf: texto(corpo.uf),
    cnaeDescricao: texto(corpo.cnae_fiscal_descricao),
    porte: porteDe(texto(corpo.descricao_porte) ?? texto(corpo.porte)),
    situacao: texto(corpo.descricao_situacao_cadastral),
  };
}

export function mapearReceitaWs(json: unknown): DadoOficial | null {
  const corpo = objeto(json);
  if (!corpo) return null;
  if (corpo.status === 'ERROR') return null;
  if (typeof corpo.nome !== 'string') return null;
  const atividade = Array.isArray(corpo.atividade_principal)
    ? objeto(corpo.atividade_principal[0])
    : null;
  return {
    razaoSocial: texto(corpo.nome),
    nomeFantasia: texto(corpo.fantasia),
    email: texto(corpo.email),
    telefone: texto(corpo.telefone),
    cep: texto(corpo.cep),
    logradouro: texto(corpo.logradouro),
    numero: texto(corpo.numero),
    complemento: texto(corpo.complemento),
    bairro: texto(corpo.bairro),
    cidade: texto(corpo.municipio),
    uf: texto(corpo.uf),
    cnaeDescricao: atividade ? texto(atividade.text) : undefined,
    situacao: texto(corpo.situacao),
  };
}

export function mapearViaCep(json: unknown): DadoOficial | null {
  const corpo = objeto(json);
  if (!corpo || corpo.erro === true || typeof corpo.logradouro !== 'string') return null;
  return {
    cep: texto(corpo.cep),
    logradouro: texto(corpo.logradouro),
    complemento: texto(corpo.complemento),
    bairro: texto(corpo.bairro),
    cidade: texto(corpo.localidade),
    uf: texto(corpo.uf),
  };
}

function porteDe(valor: string | undefined): DadoOficial['porte'] {
  if (!valor) return undefined;
  const normal = valor.toUpperCase();
  if (normal.includes('MEI')) return 'MEI';
  if (normal.includes('PEQUENO') || normal === 'EPP') return 'EPP';
  if (normal.includes('MICRO') || normal === 'ME') return 'ME';
  if (normal.includes('DEMAIS')) return 'DEMAIS';
  return undefined;
}

function objeto(valor: unknown): Record<string, unknown> | null {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null;
  return valor as Record<string, unknown>;
}

function texto(valor: unknown): string | undefined {
  if (typeof valor !== 'string') return undefined;
  const limpo = valor.trim();
  return limpo || undefined;
}
