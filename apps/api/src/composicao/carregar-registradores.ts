import type { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';

const REGISTRADORES = ['../seguranca/registrar-plugins', '../qualidade/registrar-plugins'];

export function carregarRegistradores(): void {
  for (const caminho of REGISTRADORES) {
    try {
      // require dinâmico: o registrador pode ainda não existir (ADR-006).
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const modulo = require(caminho) as { registrar?: () => void };
      modulo.registrar?.();
    } catch (erro) {
      if (moduloAusente(erro, caminho)) continue;
      throw erro;
    }
  }
}

export async function garantirIndicesSeExistirem(app: INestApplication): Promise<void> {
  const caminho = '../contatos/schemas/garantir-indices';
  try {
    // require dinâmico: o schema chega no card do ARQ-02 (ADR-006).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const modulo = require(caminho) as {
      garantirIndices?: (conexao: Connection) => Promise<void>;
    };
    if (!modulo.garantirIndices) return;
    const conexao = app.get<Connection>(getConnectionToken());
    await modulo.garantirIndices(conexao);
  } catch (erro) {
    if (moduloAusente(erro, caminho)) return;
    throw erro;
  }
}

function moduloAusente(erro: unknown, caminho: string): boolean {
  if (!erro || typeof erro !== 'object' || !('code' in erro)) return false;
  if ((erro as { code: unknown }).code !== 'MODULE_NOT_FOUND') return false;
  const mensagem = erro instanceof Error ? erro.message : '';
  return mensagem.includes(caminho);
}
