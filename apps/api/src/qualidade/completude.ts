export const PESOS_COMPLETUDE = {
  nome: 20,
  documentoValido: 20,
  telefone: 15,
  email: 10,
  enderecoCompleto: 15,
  tipoPessoaDefinido: 10,
  camposEspecificos: 10,
} as const;

export const LIMIAR_CAPTURA = 25;

export type StatusContato = 'rascunho' | 'capturado' | 'qualificado' | 'cliente' | 'descartado';
export type TipoPessoa = 'PF' | 'PJ' | 'INDEFINIDO';

export interface EntradaCompletude {
  nome?: string;
  documentoValido?: boolean;
  telefone?: boolean;
  email?: boolean;
  enderecoCompleto?: boolean;
  tipoPessoa?: TipoPessoa;
  campoEspecifico?: boolean;
  status?: StatusContato;
}

export interface ResultadoCompletude {
  score: number;
  camposFaltantes: string[];
  status: StatusContato;
}

export function calcularCompletude(entrada: EntradaCompletude): ResultadoCompletude {
  let score = 0;
  const camposFaltantes: string[] = [];

  if (entrada.nome?.trim()) score += PESOS_COMPLETUDE.nome;
  else camposFaltantes.push('nome');

  if (entrada.documentoValido) score += PESOS_COMPLETUDE.documentoValido;
  else camposFaltantes.push('documentoValido');

  if (entrada.telefone) score += PESOS_COMPLETUDE.telefone;
  else camposFaltantes.push('telefone');

  if (entrada.email) score += PESOS_COMPLETUDE.email;
  else camposFaltantes.push('email');

  if (entrada.enderecoCompleto) score += PESOS_COMPLETUDE.enderecoCompleto;
  else camposFaltantes.push('enderecoCompleto');

  if (entrada.tipoPessoa && entrada.tipoPessoa !== 'INDEFINIDO')
    score += PESOS_COMPLETUDE.tipoPessoaDefinido;
  else camposFaltantes.push('tipoPessoa');

  if (entrada.campoEspecifico) score += PESOS_COMPLETUDE.camposEspecificos;
  else camposFaltantes.push('camposEspecificos');

  const statusAtual = entrada.status ?? 'rascunho';
  const status = statusAtual === 'rascunho' && score >= LIMIAR_CAPTURA ? 'capturado' : statusAtual;
  return { score, camposFaltantes, status };
}

export interface EnderecoMinimo {
  logradouro?: string;
  numero?: string;
  cidade?: string;
  uf?: string;
}

export function enderecoCompleto(endereco: EnderecoMinimo): boolean {
  return Boolean(endereco.logradouro && endereco.numero && endereco.cidade && endereco.uf);
}
