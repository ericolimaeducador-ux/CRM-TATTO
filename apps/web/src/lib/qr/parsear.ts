export type FormatoQr =
  'vcard' | 'mecard' | 'url' | 'email' | 'telefone' | 'texto' | 'desconhecido';

export interface LeituraQr {
  formato: FormatoQr;
  nome?: string;
  telefone?: string;
  email?: string;
  observacoes?: string;
  payloadBruto: string;
  reconhecido: boolean;
}

export function parsearQr(bruto: string): LeituraQr {
  const texto = bruto.replace(/^\uFEFF/, '').trim();
  if (!texto) return { formato: 'desconhecido', payloadBruto: bruto, reconhecido: false };
  if (/^BEGIN:VCARD/i.test(texto)) return { ...lerVcard(texto), payloadBruto: bruto };
  if (/^MECARD:/i.test(texto)) return { ...lerMecard(texto), payloadBruto: bruto };
  if (/^mailto:/i.test(texto)) {
    return {
      formato: 'email',
      email: decodificar(texto.slice(7).split('?')[0] ?? ''),
      payloadBruto: bruto,
      reconhecido: true,
    };
  }
  if (/^tel:/i.test(texto)) {
    return {
      formato: 'telefone',
      telefone: decodificar(texto.slice(4)),
      payloadBruto: bruto,
      reconhecido: true,
    };
  }
  if (/^https?:\/\//i.test(texto)) {
    return { formato: 'url', observacoes: texto, payloadBruto: bruto, reconhecido: true };
  }
  return { formato: 'texto', observacoes: texto, payloadBruto: bruto, reconhecido: true };
}

function lerVcard(texto: string): Omit<LeituraQr, 'payloadBruto'> {
  const linhas = desdobrar(texto);
  const campos = new Map<string, string>();
  for (const linha of linhas) {
    const separador = linha.indexOf(':');
    if (separador < 0) continue;
    const chave = linha.slice(0, separador).split(';')[0]?.toUpperCase() ?? '';
    campos.set(chave, linha.slice(separador + 1).trim());
  }
  const fn = campos.get('FN');
  const n = campos.get('N');
  const nome = fn?.trim() || nomeDeN(n);
  return {
    formato: 'vcard',
    nome,
    telefone: primeiroValor(campos, 'TEL'),
    email: primeiroValor(campos, 'EMAIL'),
    reconhecido: true,
  };
}

function lerMecard(texto: string): Omit<LeituraQr, 'payloadBruto'> {
  const corpo = texto.replace(/^MECARD:/i, '').replace(/;;\s*$/, '');
  const campos = new Map<string, string>();
  for (const parte of corpo.split(';')) {
    const separador = parte.indexOf(':');
    if (separador < 0) continue;
    campos.set(parte.slice(0, separador).toUpperCase(), parte.slice(separador + 1));
  }
  return {
    formato: 'mecard',
    nome: campos.get('N'),
    telefone: campos.get('TEL'),
    email: campos.get('EMAIL'),
    reconhecido: true,
  };
}

function desdobrar(texto: string): string[] {
  const saida: string[] = [];
  for (const linha of texto.split(/\r?\n/)) {
    if ((linha.startsWith(' ') || linha.startsWith('\t')) && saida.length > 0) {
      saida[saida.length - 1] += linha.slice(1);
    } else if (linha.trim()) saida.push(linha.trim());
  }
  return saida;
}

function nomeDeN(valor: string | undefined): string | undefined {
  if (!valor) return undefined;
  const [familia, nome] = valor.split(';');
  return [nome, familia].filter(Boolean).join(' ').trim() || undefined;
}

function primeiroValor(campos: Map<string, string>, chave: string): string | undefined {
  return campos.get(chave);
}

function decodificar(valor: string): string {
  try {
    return decodeURIComponent(valor);
  } catch {
    return valor;
  }
}
