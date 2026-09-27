const FUSO = 'America/Sao_Paulo';

export function dataBr(valor?: string | null): string {
  const data = ler(valor);
  if (!data) return valor ? valor : 'sem data';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(data);
}

export function dataHoraBr(valor?: string | null): string {
  const data = ler(valor);
  if (!data) return valor ? valor : 'sem horário';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(data);
}

export function mascararData(bruto: string): string {
  const digitos = bruto.replace(/\D/g, '').slice(0, 8);
  const dia = digitos.slice(0, 2);
  const mes = digitos.slice(2, 4);
  const ano = digitos.slice(4, 8);
  if (digitos.length <= 2) return dia;
  if (digitos.length <= 4) return `${dia}/${mes}`;
  return `${dia}/${mes}/${ano}`;
}

export function isoDeBr(valor: string): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(valor.trim());
  if (!match) return '';
  const dia = Number(match[1]);
  const mes = Number(match[2]);
  const ano = Number(match[3]);
  if (mes < 1 || mes > 12 || dia < 1 || ano < 1900) return '';
  const prova = new Date(Date.UTC(ano, mes - 1, dia));
  if (
    prova.getUTCFullYear() !== ano ||
    prova.getUTCMonth() !== mes - 1 ||
    prova.getUTCDate() !== dia
  ) {
    return '';
  }
  return `${match[3]}-${match[2]}-${match[1]}`;
}

export function brDeIso(valor: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!match) return '';
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function ler(valor?: string | null): Date | null {
  if (!valor) return null;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data;
}
