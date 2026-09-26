import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const VERSAO_TERMO = '[A PREENCHER, D1]';

const ARQUIVO = 'TERMO_CONSENTIMENTO_CAPTURA7_minuta_v2.md';

export interface TextoTermo {
  versao: string;
  textoCurto: string;
  textoCompleto: string;
  hash: string;
}

let cache: TextoTermo | null = null;

export function textoDoTermo(): TextoTermo {
  if (cache) return cache;
  const minuta = lerMinuta();
  const textoCurto = entre(minuta, '**Seus dados no captura7**', '## PARTE 2').trim();
  const textoCompleto = entre(minuta, '## PARTE 2 — Versão completa', '## PARTE 3').trim();
  cache = {
    versao: VERSAO_TERMO,
    textoCurto,
    textoCompleto,
    hash: createHash('sha256').update(textoCurto, 'utf8').digest('hex'),
  };
  return cache;
}

function entre(texto: string, inicio: string, fim: string): string {
  const de = texto.indexOf(inicio);
  const ate = texto.indexOf(fim);
  if (de < 0 || ate <= de) {
    throw new Error(
      'A minuta do termo não contém a Parte 1 e a Parte 2. O texto não foi reescrito.',
    );
  }
  return texto.slice(de, ate);
}

function lerMinuta(): string {
  const candidatos = [
    join(process.cwd(), 'docs/lgpd', ARQUIVO),
    join(process.cwd(), '../../docs/lgpd', ARQUIVO),
    join(__dirname, '../../../../docs/lgpd', ARQUIVO),
  ];
  for (const caminho of candidatos) {
    try {
      return readFileSync(caminho, 'utf8');
    } catch {
      continue;
    }
  }
  throw new Error('Minuta do termo ausente no disco. O texto não foi inventado.');
}
