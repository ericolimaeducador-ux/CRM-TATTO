import { jaroWinkler } from './jaro';

export interface ContatoComparavel {
  nome?: string;
  emails?: { valor?: string }[];
  telefones?: { e164?: string }[];
  enderecos?: { cidade?: string }[];
  pf?: { cpfHash?: string };
  pj?: { cnpjHash?: string; cnpjRaiz?: string; cnpjMascarado?: string };
}

export interface Comparacao {
  duplicata?: { motivo: string; similaridade: number };
  relacionado?: 'matriz' | 'filial' | 'grupo';
}

const LIMIAR_NOME = 0.92;

export function compararContatos(
  atual: ContatoComparavel,
  outro: ContatoComparavel,
): Comparacao | null {
  const relacionado = matrizOuFilial(atual, outro);
  if (relacionado) return { relacionado };
  if (atual.pf?.cpfHash && atual.pf.cpfHash === outro.pf?.cpfHash) {
    return { duplicata: { motivo: 'cpf', similaridade: 1 } };
  }
  if (atual.pj?.cnpjHash && atual.pj.cnpjHash === outro.pj?.cnpjHash) {
    return { duplicata: { motivo: 'cnpj', similaridade: 1 } };
  }
  const emailAtual = primeiroEmail(atual);
  const emailOutro = primeiroEmail(outro);
  if (emailAtual && emailAtual === emailOutro) {
    return { duplicata: { motivo: 'email', similaridade: 0.95 } };
  }
  const telefoneAtual = atual.telefones?.find((item) => item.e164)?.e164;
  const telefoneOutro = outro.telefones?.find((item) => item.e164)?.e164;
  if (telefoneAtual && telefoneAtual === telefoneOutro) {
    return { duplicata: { motivo: 'telefone', similaridade: 0.9 } };
  }
  return porNomeECidade(atual, outro);
}

function matrizOuFilial(
  atual: ContatoComparavel,
  outro: ContatoComparavel,
): Comparacao['relacionado'] {
  const raizAtual = atual.pj?.cnpjRaiz;
  const raizOutro = outro.pj?.cnpjRaiz;
  if (!raizAtual || raizAtual !== raizOutro) return undefined;
  if (!atual.pj?.cnpjHash || !outro.pj?.cnpjHash) return undefined;
  if (atual.pj.cnpjHash === outro.pj.cnpjHash) return undefined;
  const ordemAtual = ordem(atual.pj.cnpjMascarado);
  const ordemOutro = ordem(outro.pj.cnpjMascarado);
  if (ordemAtual === ordemOutro) return 'grupo';
  return ordemAtual < ordemOutro ? 'filial' : 'matriz';
}

function porNomeECidade(atual: ContatoComparavel, outro: ContatoComparavel): Comparacao | null {
  const nomeAtual = chave(atual.nome);
  const nomeOutro = chave(outro.nome);
  const cidadeAtual = chave(atual.enderecos?.[0]?.cidade);
  const cidadeOutro = chave(outro.enderecos?.[0]?.cidade);
  if (!nomeAtual || !nomeOutro || !cidadeAtual || cidadeAtual !== cidadeOutro) return null;
  const similaridade = jaroWinkler(nomeAtual, nomeOutro);
  if (similaridade < LIMIAR_NOME) return null;
  return { duplicata: { motivo: 'nome_cidade', similaridade: Number(similaridade.toFixed(4)) } };
}

function primeiroEmail(contato: ContatoComparavel): string {
  return contato.emails?.[0]?.valor?.trim().toLowerCase() ?? '';
}

function chave(valor: string | undefined): string {
  return (valor ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

function ordem(mascarado: string | undefined): number {
  const achado = mascarado?.match(/\/(\d{4})-/);
  return achado ? Number(achado[1]) : Number.MAX_SAFE_INTEGER;
}
