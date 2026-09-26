import mongoose from 'mongoose';
import { down, up } from './20260925-indices-contatos';

async function main(): Promise<void> {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('Defina MONGO_URI. Sem isso a migração não tem alvo.');
  }
  const conexao = mongoose.createConnection(uri);
  await conexao.asPromise();
  try {
    const db = conexao.db;
    if (!db) throw new Error('Conexão sem banco.');
    const direcao = process.argv.includes('--down') ? 'down' : 'up';
    if (direcao === 'down') await down(db);
    else await up(db);
    console.log(JSON.stringify({ nivel: 'INFO', evento: 'migracao_aplicada', direcao }));
  } finally {
    await conexao.close();
  }
}

main().catch((erro: unknown) => {
  const mensagem = erro instanceof Error ? erro.message : 'erro desconhecido';
  console.error(JSON.stringify({ nivel: 'ERROR', evento: 'migracao_falhou', mensagem }));
  process.exit(1);
});
