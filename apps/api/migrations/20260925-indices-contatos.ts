import type { Connection } from 'mongoose';
import { INDICES } from '../src/contatos/schemas/indices';

type Banco = NonNullable<Connection['db']>;

export async function up(db: Banco): Promise<void> {
  for (const indice of INDICES) {
    const colecao = db.collection(indice.colecao) as {
      createIndex(campos: unknown, opcoes: unknown): Promise<string>;
    };
    await colecao.createIndex(indice.campos, indice.opcoes);
  }
}

export async function down(db: Banco): Promise<void> {
  for (const indice of [...INDICES].reverse()) {
    try {
      await db.collection(indice.colecao).dropIndex(indice.opcoes.name);
    } catch (erro) {
      if (indiceAusente(erro)) continue;
      throw erro;
    }
  }
}

function indiceAusente(erro: unknown): boolean {
  if (!erro || typeof erro !== 'object' || !('code' in erro)) return false;
  const codigo = (erro as { code: unknown }).code;
  return codigo === 27 || codigo === 'IndexNotFound';
}
