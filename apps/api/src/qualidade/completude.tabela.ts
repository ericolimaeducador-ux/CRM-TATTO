import type { EntradaCompletude, ResultadoCompletude } from './completude';

export interface LinhaCompletude {
  nome: string;
  entrada: EntradaCompletude;
  esperado: Pick<ResultadoCompletude, 'score' | 'status'>;
}

export const TABELA_COMPLETUDE: LinhaCompletude[] = [
  { nome: 'só nome', entrada: { nome: 'Ana' }, esperado: { score: 20, status: 'rascunho' } },
  {
    nome: 'nome e telefone',
    entrada: { nome: 'Ana', telefone: true },
    esperado: { score: 35, status: 'capturado' },
  },
  {
    nome: 'nome e e-mail',
    entrada: { nome: 'Ana', email: true },
    esperado: { score: 30, status: 'capturado' },
  },
  { nome: 'só telefone', entrada: { telefone: true }, esperado: { score: 15, status: 'rascunho' } },
  {
    nome: 'nome, documento e tipo PF',
    entrada: { nome: 'Ana', documentoValido: true, tipoPessoa: 'PF' },
    esperado: { score: 50, status: 'capturado' },
  },
  {
    nome: 'nome com documento inválido',
    entrada: { nome: 'Ana', documentoValido: false },
    esperado: { score: 20, status: 'rascunho' },
  },
  {
    nome: 'nome e endereço completo',
    entrada: { nome: 'Ana', enderecoCompleto: true },
    esperado: { score: 35, status: 'capturado' },
  },
  {
    nome: 'PJ com documento e campo específico',
    entrada: { nome: 'Casa', documentoValido: true, tipoPessoa: 'PJ', campoEspecifico: true },
    esperado: { score: 60, status: 'capturado' },
  },
  { nome: 'só e-mail', entrada: { email: true }, esperado: { score: 10, status: 'rascunho' } },
  {
    nome: 'tudo preenchido',
    entrada: {
      nome: 'Ana',
      documentoValido: true,
      telefone: true,
      email: true,
      enderecoCompleto: true,
      tipoPessoa: 'PF',
      campoEspecifico: true,
    },
    esperado: { score: 100, status: 'capturado' },
  },
  {
    nome: 'só tipo definido',
    entrada: { tipoPessoa: 'PF' },
    esperado: { score: 10, status: 'rascunho' },
  },
  {
    nome: 'documento e telefone sem nome',
    entrada: { documentoValido: true, telefone: true },
    esperado: { score: 35, status: 'capturado' },
  },
];
