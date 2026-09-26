import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Type } from '@nestjs/common';

export function descobrirModulos(raiz: string): Type<unknown>[] {
  const encontrados: Type<unknown>[] = [];
  visitar(raiz, encontrados);
  return encontrados;
}

function visitar(diretorio: string, encontrados: Type<unknown>[]): void {
  for (const entrada of readdirSync(diretorio)) {
    const caminho = join(diretorio, entrada);
    if (statSync(caminho).isDirectory()) {
      visitar(caminho, encontrados);
      continue;
    }
    if (!entrada.endsWith('.module.js') || entrada === 'app.module.js') continue;
    // require dinâmico: o arquivo só existe depois que o agente dono o cria (ADR-006).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const modulo = require(caminho) as Record<string, unknown>;
    for (const valor of Object.values(modulo)) {
      if (
        typeof valor === 'function' &&
        valor.name.endsWith('Module') &&
        valor.name !== 'AppModule'
      ) {
        encontrados.push(valor as Type<unknown>);
      }
    }
  }
}
