import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export function carregarEnv(diretorio = process.cwd()): void {
  const candidatos = [join(diretorio, '.env'), join(diretorio, '../../.env')];
  for (const caminho of candidatos) {
    if (!existsSync(caminho)) continue;
    aplicar(readFileSync(caminho, 'utf8'));
  }
}

function aplicar(texto: string): void {
  for (const bruta of texto.split('\n')) {
    const limpa = bruta.trim();
    if (!limpa || limpa.startsWith('#')) continue;
    const igual = limpa.indexOf('=');
    if (igual <= 0) continue;
    const chave = limpa.slice(0, igual).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(chave)) continue;
    if (process.env[chave] !== undefined) continue;
    let valor = limpa.slice(igual + 1).trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    process.env[chave] = valor;
  }
}
