import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { down, up } from '../migrations/20260925-indices-contatos';

describe('migração de índices', () => {
  it('sobe duas vezes e desce', async () => {
    const memoria = await MongoMemoryServer.create();
    const conexao = mongoose.createConnection(memoria.getUri());
    await conexao.asPromise();
    const db = conexao.db;
    if (!db) throw new Error('Conexão sem banco.');
    await up(db);
    await up(db);
    const nomes = (await db.collection('contatos').indexes()).map((indice) => indice.name);
    expect(nomes).toContain('uniq_pf_cpfHash_nao_rascunho');
    expect(nomes).toContain('uniq_idLocal');
    await down(db);
    const depois = (await db.collection('contatos').indexes()).map((indice) => indice.name);
    expect(depois).not.toContain('uniq_pf_cpfHash_nao_rascunho');
    await conexao.close();
    await memoria.stop();
  });
});
