import { aviso, type Aviso } from './avisos';
import { apenasDigitos, cnpjValido, cpfValido } from './documento';

const PREPOSICOES = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);

export function normalizarNome(valor: string): string {
  const limpo = valor.trim().replace(/\s+/g, ' ');
  if (!limpo) return valor;
  return limpo
    .split(' ')
    .map((palavra, indice) => {
      const minuscula = palavra.toLocaleLowerCase('pt-BR');
      if (indice > 0 && PREPOSICOES.has(minuscula)) return minuscula;
      return minuscula.charAt(0).toLocaleUpperCase('pt-BR') + minuscula.slice(1);
    })
    .join(' ');
}

export function normalizarEmail(valor: string): { valor: string; aviso?: Aviso } {
  const ajustado = valor.trim().toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ajustado)) return { valor: ajustado };
  return {
    valor,
    aviso: aviso(
      'emails',
      'EMAIL_INVALIDO',
      'Este e-mail não parece válido. Gravamos como você digitou. Corrija quando puder.',
    ),
  };
}

export function normalizarTelefone(bruto: string): { bruto: string; e164?: string; aviso?: Aviso } {
  const digitos = apenasDigitos(bruto);
  if (digitos.startsWith('55') && (digitos.length === 12 || digitos.length === 13)) {
    return { bruto, e164: `+${digitos}` };
  }
  if (!bruto.trim().startsWith('+') && (digitos.length === 10 || digitos.length === 11)) {
    return { bruto, e164: `+55${digitos}` };
  }
  return {
    bruto,
    aviso: aviso(
      'telefones',
      'TELEFONE_INVALIDO',
      'Não deu para converter este telefone para E.164. Ele foi gravado como você digitou.',
    ),
  };
}

export function normalizarCpf(valor: string): { valor: string; valido: boolean; aviso?: Aviso } {
  if (cpfValido(valor)) return { valor: apenasDigitos(valor), valido: true };
  return {
    valor,
    valido: false,
    aviso: aviso(
      'pf.cpf',
      'CPF_INVALIDO',
      'CPF não confere o dígito. Gravamos como veio e o rascunho continua salvo.',
    ),
  };
}

export function normalizarCnpj(valor: string): { valor: string; valido: boolean; aviso?: Aviso } {
  if (cnpjValido(valor)) return { valor: apenasDigitos(valor), valido: true };
  return {
    valor,
    valido: false,
    aviso: aviso(
      'pj.cnpj',
      'CNPJ_INVALIDO',
      'CNPJ não confere o dígito. Gravamos como veio e o rascunho continua salvo.',
    ),
  };
}

export function normalizarCep(valor: string): { valor: string; aviso?: Aviso } {
  const digitos = apenasDigitos(valor);
  if (digitos.length === 8) return { valor: digitos };
  return {
    valor,
    aviso: aviso(
      'enderecos.cep',
      'CEP_INVALIDO',
      'CEP precisa ter 8 dígitos. Gravamos como você digitou.',
    ),
  };
}
