import { createHash } from 'node:crypto';
import type { CriarContatoDto } from '../contatos/criar-contato.dto';

const ALIAS: Record<string, string> = {
  nome: 'nome',
  'e-mail': 'email',
  email: 'email',
  telefone: 'telefone',
  cnpj: 'cnpj',
  cpf: 'cpf',
  observacoes: 'observacoes',
  observações: 'observacoes',
  cep: 'cep',
  cidade: 'cidade',
  empresa: 'razaoSocial',
  instituicao: 'razaoSocial',
  instituição: 'razaoSocial',
  'razao social': 'razaoSocial',
  'razão social': 'razaoSocial',
  razaosocial: 'razaoSocial',
};

export interface LinhaPlanilha {
  linha: number;
  campos: Record<string, string>;
  hash: string;
}

export function lerPlanilha(values: unknown): LinhaPlanilha[] {
  if (!Array.isArray(values)) return [];
  const linhas = values.filter((linha): linha is unknown[] => Array.isArray(linha));
  if (linhas.length === 0) return [];
  const cabecalho = linhas[0].map((celula) => texto(celula).toLocaleLowerCase('pt-BR'));
  const saida: LinhaPlanilha[] = [];
  for (let indice = 1; indice < linhas.length; indice += 1) {
    const campos: Record<string, string> = {};
    linhas[indice].forEach((celula, coluna) => {
      const chave = ALIAS[cabecalho[coluna] ?? ''];
      const valor = texto(celula);
      if (chave && valor) campos[chave] = valor;
    });
    if (Object.keys(campos).length === 0) continue;
    saida.push({ linha: indice, campos, hash: hashLinha(campos) });
  }
  return saida;
}

export function contatoDaLinha(linha: LinhaPlanilha): CriarContatoDto {
  return {
    idLocal: `sheets-${linha.hash}`,
    nome: linha.campos.nome,
    email: linha.campos.email,
    telefone: linha.campos.telefone,
    cnpj: linha.campos.cnpj,
    cpf: linha.campos.cpf,
    razaoSocial: linha.campos.razaoSocial,
    cep: linha.campos.cep,
    cidade: linha.campos.cidade,
    observacoes: linha.campos.observacoes,
    origem: { modo: 'importado', payloadBruto: JSON.stringify(linha.campos) },
  };
}

export function hashLinha(campos: Record<string, string>): string {
  const pares = Object.keys(campos)
    .sort()
    .map((chave) => [chave, campos[chave].trim()]);
  return createHash('sha256').update(JSON.stringify(pares)).digest('hex');
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}
