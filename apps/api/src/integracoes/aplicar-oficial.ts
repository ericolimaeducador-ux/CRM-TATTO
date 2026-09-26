import { normalizarNome, normalizarTelefone } from '../normalizacao/normalizar';
import type { DadoOficial } from './mapear-oficial';

export interface Sugestao {
  campo: string;
  valorDigitado: string;
  valorFonte: string;
  fonte: string;
}

export function aplicarOficial(
  atual: Record<string, unknown>,
  dado: DadoOficial,
  fonte: string,
): { sugestoes: Sugestao[]; alterou: boolean } {
  const sugestoes: Sugestao[] = [];
  let alterou = false;
  const pj = objeto(atual.pj);
  alterou =
    definirTexto(pj, 'razaoSocial', dado.razaoSocial, fonte, sugestoes, (valor) =>
      normalizarNome(valor),
    ) || alterou;
  alterou =
    definirTexto(pj, 'nomeFantasia', dado.nomeFantasia, fonte, sugestoes, (valor) =>
      valor.trim(),
    ) || alterou;
  if (dado.porte && !pj.porte) {
    pj.porte = dado.porte;
    alterou = true;
  }
  if (dado.situacao && !pj.situacaoCadastral) {
    pj.situacaoCadastral = dado.situacao;
    alterou = true;
  }
  if (dado.cnaeDescricao && !objeto(pj.cnaePrincipal).descricao) {
    pj.cnaePrincipal = { descricao: dado.cnaeDescricao };
    alterou = true;
  }
  atual.pj = pj;

  if (atual.tipoPessoa === 'INDEFINIDO' && (dado.razaoSocial || dado.nomeFantasia)) {
    atual.tipoPessoa = 'PJ';
    alterou = true;
  } else if (atual.tipoPessoa === 'PF' && dado.razaoSocial) {
    sugestoes.push({
      campo: 'tipoPessoa',
      valorDigitado: 'PF',
      valorFonte: 'PJ',
      fonte,
    });
  }

  alterou =
    definirLista(atual, 'emails', 'email', dado.email, fonte, sugestoes, (valor) => ({
      valor: valor.trim().toLowerCase(),
      principal: true,
    })) || alterou;
  alterou =
    definirLista(atual, 'telefones', 'telefone', dado.telefone, fonte, sugestoes, (valor) => {
      const telefone = normalizarTelefone(valor);
      return { bruto: telefone.bruto, e164: telefone.e164, principal: true };
    }) || alterou;

  const enderecos = Array.isArray(atual.enderecos) ? [...atual.enderecos] : [];
  const endereco = objeto(enderecos[0]);
  for (const campo of [
    'cep',
    'logradouro',
    'numero',
    'complemento',
    'bairro',
    'cidade',
    'uf',
  ] as const) {
    const valor = dado[campo];
    if (!valor) continue;
    const digitado = typeof endereco[campo] === 'string' ? endereco[campo] : '';
    if (!String(digitado).trim()) {
      endereco[campo] = valor;
      alterou = true;
    } else if (String(digitado).trim() !== valor.trim()) {
      sugestoes.push({ campo, valorDigitado: String(digitado), valorFonte: valor, fonte });
    }
  }
  if (alterou || Object.keys(endereco).length > 0) {
    enderecos[0] = endereco;
    atual.enderecos = enderecos;
  }
  return { sugestoes, alterou };
}

function definirTexto(
  destino: Record<string, unknown>,
  campo: string,
  valor: string | undefined,
  fonte: string,
  sugestoes: Sugestao[],
  normalizar: (valor: string) => string,
): boolean {
  if (!valor) return false;
  const novo = normalizar(valor);
  const atual = typeof destino[campo] === 'string' ? destino[campo] : '';
  if (!atual.trim()) {
    destino[campo] = novo;
    return true;
  }
  if (atual.trim() !== novo.trim()) {
    sugestoes.push({ campo, valorDigitado: atual, valorFonte: novo, fonte });
  }
  return false;
}

function definirLista(
  atual: Record<string, unknown>,
  chave: 'emails' | 'telefones',
  campo: string,
  valor: string | undefined,
  fonte: string,
  sugestoes: Sugestao[],
  montar: (valor: string) => Record<string, unknown>,
): boolean {
  if (!valor) return false;
  const lista = Array.isArray(atual[chave]) ? (atual[chave] as Record<string, unknown>[]) : [];
  const primeiro = lista[0];
  const digitado =
    primeiro && typeof primeiro.valor === 'string'
      ? primeiro.valor
      : primeiro && typeof primeiro.bruto === 'string'
        ? primeiro.bruto
        : '';
  if (!digitado.trim()) {
    atual[chave] = [montar(valor)];
    return true;
  }
  if (digitado.trim().toLowerCase() !== valor.trim().toLowerCase()) {
    sugestoes.push({ campo, valorDigitado: digitado, valorFonte: valor, fonte });
  }
  return false;
}

function objeto(valor: unknown): Record<string, unknown> {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return {};
  return { ...(valor as Record<string, unknown>) };
}
