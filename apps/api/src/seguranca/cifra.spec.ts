import { randomBytes } from 'node:crypto';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { type Connection } from 'mongoose';
import { registrarModelos, type ModelosContato } from '../contatos/schemas/registrar-modelos';
import { aplicarSegurancaNoSchema } from './aplicar-no-schema';
import { contatoSchema } from '../contatos/schemas/contato.schema';
import { cifrar, decifrar, hmacDocumento, mascararCnpj, mascararCpf } from './cifra';

const CPF = '52998224725';

describe('cifra de documento', () => {
  const chaveOriginal = process.env.CIFRA_CHAVE_BASE64;
  const pepperOriginal = process.env.CIFRA_PEPPER;

  beforeEach(() => {
    process.env.CIFRA_CHAVE_BASE64 = randomBytes(32).toString('base64');
    process.env.CIFRA_PEPPER = randomBytes(32).toString('hex');
  });

  afterAll(() => {
    if (chaveOriginal === undefined) delete process.env.CIFRA_CHAVE_BASE64;
    else process.env.CIFRA_CHAVE_BASE64 = chaveOriginal;
    if (pepperOriginal === undefined) delete process.env.CIFRA_PEPPER;
    else process.env.CIFRA_PEPPER = pepperOriginal;
  });

  it('cifra e decifra sem guardar o valor puro', () => {
    const pacote = cifrar(CPF);
    expect(pacote).not.toContain(CPF);
    expect(decifrar(pacote)).toBe(CPF);
    expect(cifrar(CPF)).not.toBe(pacote);
  });

  it('calcula hmac estável e muda com o pepper', () => {
    const primeiro = hmacDocumento(CPF);
    expect(hmacDocumento(CPF)).toBe(primeiro);
    process.env.CIFRA_PEPPER = randomBytes(32).toString('hex');
    expect(hmacDocumento(CPF)).not.toBe(primeiro);
  });

  it('mascara CPF e CNPJ para lista', () => {
    expect(mascararCpf(CPF)).toBe('***.982.247-**');
    expect(mascararCnpj('11222333000181')).toBe('**.222.333/0001-**');
  });

  it('recusa operar sem chave', () => {
    delete process.env.CIFRA_CHAVE_BASE64;
    expect(() => cifrar(CPF)).toThrow(/CIFRA_CHAVE_BASE64/);
  });
});

describe('plugin de cifra no schema', () => {
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
  });

  afterAll(async () => {
    await conexao.close();
    await memoria.stop();
  });

  it('persiste CPF só como cifra, hash e máscara', async () => {
    const doc = new modelos.Contato({ nome: 'Ana', origem: { modo: 'manual' } });
    doc.$locals.cpfPuro = CPF;
    await doc.save();
    const lido = await modelos.Contato.findById(doc._id).lean();
    const texto = JSON.stringify(lido);
    expect(texto).not.toContain(CPF);
    expect(lido?.pf?.cpfHash).toBe(hmacDocumento(CPF));
    expect(lido?.pf?.cpfMascarado).toBe('***.982.247-**');
    expect(decifrar(String(lido?.pf?.cpfCifrado))).toBe(CPF);
    expect(lido?.lgpd?.baseLegal).toBe('legitimo_interesse');
  });

  it('preenche consentimento no qr_proprio e respeita escolha explícita', async () => {
    const peloModo = new modelos.Contato({ nome: 'Bia', origem: { modo: 'qr_proprio' } });
    await peloModo.save();
    expect(peloModo.lgpd.baseLegal).toBe('consentimento');
    expect(peloModo.lgpd.finalidade).toContain('relacionamento comercial');

    const explicito = new modelos.Contato({
      nome: 'Caio',
      origem: { modo: 'qr_lido' },
      lgpd: { baseLegal: 'execucao_contrato', finalidade: ['entrega'], canalColeta: 'qr_lido' },
    });
    explicito.$locals.baseLegalExplicita = true;
    await explicito.save();
    expect(explicito.lgpd.baseLegal).toBe('execucao_contrato');
  });
});
