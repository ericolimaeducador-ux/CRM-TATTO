import { randomBytes } from 'node:crypto';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { type Connection } from 'mongoose';
import { ErroNomeado } from '../src/contatos/schemas/erro-nomeado';
import { contatoSchema } from '../src/contatos/schemas/contato.schema';
import { registrarModelos, type ModelosContato } from '../src/contatos/schemas/registrar-modelos';
import { aplicarSegurancaNoSchema } from '../src/seguranca/aplicar-no-schema';

describe('critérios do F0-02', () => {
  let memoria: MongoMemoryServer;
  let conexao: Connection;
  let modelos: ModelosContato;

  beforeAll(async () => {
    process.env.CIFRA_CHAVE_BASE64 = randomBytes(32).toString('base64');
    process.env.CIFRA_PEPPER = randomBytes(32).toString('hex');
    aplicarSegurancaNoSchema(contatoSchema);
    memoria = await MongoMemoryServer.create();
    conexao = mongoose.createConnection(memoria.getUri());
    await conexao.asPromise();
    modelos = registrarModelos(conexao);
    await modelos.Contato.createIndexes();
    await modelos.ContatoAuditoria.createIndexes();
  });

  afterAll(async () => {
    await conexao.close();
    await memoria.stop();
  });

  it('persiste { nome: Ana } sem erro e com tipoPessoa INDEFINIDO', async () => {
    const contato = await modelos.Contato.create({ nome: 'Ana' });
    expect(contato.nome).toBe('Ana');
    expect(contato.status).toBe('rascunho');
    expect(contato.tipoPessoa).toBe('INDEFINIDO');
    expect(contato.codigo).toMatch(/^LD-\d{4}-\d{5}$/);
    expect(contato.lgpd.baseLegal).toBe('legitimo_interesse');
  });

  it('persiste tipoPessoa INDEFINIDO quando ele vem explícito', async () => {
    const contato = await modelos.Contato.create({ nome: 'Bia', tipoPessoa: 'INDEFINIDO' });
    const lido = await modelos.Contato.findById(contato._id).lean();
    expect(lido?.tipoPessoa).toBe('INDEFINIDO');
  });

  it('deixa dois rascunhos com o mesmo CPF coexistirem', async () => {
    const hash = 'hash-do-mesmo-cpf';
    const primeiro = await modelos.Contato.create({ nome: 'Carla', pf: { cpfHash: hash } });
    const segundo = await modelos.Contato.create({ nome: 'Dora', pf: { cpfHash: hash } });
    expect(primeiro.pf?.cpfHash).toBe(hash);
    expect(segundo.pf?.cpfHash).toBe(hash);
    expect(String(primeiro._id)).not.toBe(String(segundo._id));
  });

  it('deixa dois descartados com o mesmo hash coexistirem', async () => {
    const hash = 'hash-descartado';
    const a = await modelos.Contato.create({
      nome: 'Eva',
      status: 'descartado',
      motivoDescarte: 'teste',
      pf: { cpfHash: hash },
    });
    const b = await modelos.Contato.create({
      nome: 'Fabi',
      status: 'descartado',
      motivoDescarte: 'teste',
      pf: { cpfHash: hash },
    });
    expect(String(a._id)).not.toBe(String(b._id));
  });

  it('rejeita qualificado duplicado com CPF_DUPLICADO e sem exceção crua do Mongo', async () => {
    const hash = 'hash-qualificado';
    await modelos.Contato.create({ nome: 'Eva', status: 'qualificado', pf: { cpfHash: hash } });
    const promessa = modelos.Contato.create({
      nome: 'Fabi',
      status: 'qualificado',
      pf: { cpfHash: hash },
    });
    await expect(promessa).rejects.toBeInstanceOf(ErroNomeado);
    await expect(promessa).rejects.toMatchObject({ codigo: 'CPF_DUPLICADO' });
    try {
      await promessa;
    } catch (erro) {
      expect(erro).not.toHaveProperty('code', 11000);
      expect(erro instanceof Error ? erro.message : '').not.toMatch(/E11000/);
      expect(erro instanceof Error ? erro.name : '').not.toBe('MongoServerError');
    }
  });

  it('grava auditoria com valor anterior e novo ao alterar não-rascunho', async () => {
    const autorId = new mongoose.Types.ObjectId();
    const contato = await modelos.Contato.create({ nome: 'Gabi', status: 'capturado' });
    contato.nome = 'Gabriela';
    contato.$locals.autorId = autorId;
    contato.$locals.autorNome = 'Helena';
    await contato.save();
    const linhas = await modelos.ContatoAuditoria.find({ contatoId: contato._id }).lean();
    expect(linhas).toHaveLength(1);
    expect(linhas[0]?.campo).toBe('nome');
    expect(linhas[0]?.valorAnterior).toBe('Gabi');
    expect(linhas[0]?.valorNovo).toBe('Gabriela');
    expect(String(linhas[0]?.autor)).toBe(String(autorId));
  });

  it('não audita edição de rascunho', async () => {
    const contato = await modelos.Contato.create({ nome: 'Iara' });
    contato.nome = 'Iara Souza';
    contato.$locals.autorId = new mongoose.Types.ObjectId();
    contato.$locals.autorNome = 'Helena';
    await contato.save();
    const linhas = await modelos.ContatoAuditoria.countDocuments({ contatoId: contato._id });
    expect(linhas).toBe(0);
  });

  it('salva rascunho com CPF malformado', async () => {
    const doc = new modelos.Contato({ nome: 'Joao' });
    doc.$locals.cpfPuro = 'NAO-E-CPF-XYZ';
    await expect(doc.save()).resolves.toBeTruthy();
    const lido = await modelos.Contato.findById(doc._id).lean();
    expect(JSON.stringify(lido)).not.toContain('NAO-E-CPF-XYZ');
    expect(lido?.pf?.cpfHash).toBeUndefined();
  });

  it('descarta criadoPor enviado pelo cliente', async () => {
    const falso = new mongoose.Types.ObjectId();
    const contato = await modelos.Contato.create({ nome: 'Lia', criadoPor: falso });
    expect(String(contato.criadoPor ?? '')).not.toBe(String(falso));
  });

  it('uma das duas promoções simultâneas com o mesmo hash perde com CPF_DUPLICADO', async () => {
    const hash = 'hash-corrida';
    const resultados = await Promise.allSettled([
      modelos.Contato.create({ nome: 'Ada', status: 'qualificado', pf: { cpfHash: hash } }),
      modelos.Contato.create({ nome: 'Bela', status: 'qualificado', pf: { cpfHash: hash } }),
    ]);
    const ok = resultados.filter((item) => item.status === 'fulfilled');
    const falhas = resultados.filter((item) => item.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(falhas).toHaveLength(1);
    const motivo = falhas[0]?.status === 'rejected' ? falhas[0].reason : undefined;
    expect(motivo).toMatchObject({ codigo: 'CPF_DUPLICADO' });
  });

  it('índice de CPF é único e parcial', async () => {
    const indices = await modelos.Contato.collection.indexes();
    const cpf = indices.find((indice) => indice.name === 'uniq_pf_cpfHash_nao_rascunho');
    expect(cpf?.unique).toBe(true);
    expect(cpf?.partialFilterExpression).toMatchObject({
      status: { $in: ['capturado', 'qualificado', 'cliente'] },
    });
  });

  it('recusa deleteOne no contato e update na auditoria', async () => {
    await expect(modelos.Contato.deleteOne({ nome: 'Ana' })).rejects.toThrow(/Exclusão física/);
    await expect(modelos.ContatoAuditoria.updateOne({}, { $set: { campo: 'x' } })).rejects.toThrow(
      /append-only/,
    );
  });
});
