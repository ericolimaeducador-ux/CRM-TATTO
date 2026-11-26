import { createHash, randomBytes } from 'node:crypto';
import { Types } from 'mongoose';
import { AtualizacaoCadastroService } from './atualizacao-cadastro.service';

const usuario = {
  id: '507f1f77bcf86cd799439011',
  nome: 'Gestão',
  papel: 'admin' as const,
  stepUp: false,
};

describe('atualização cadastral pública', () => {
  const contatoId = new Types.ObjectId();
  const token = new Types.ObjectId();
  let contato: Record<string, unknown> & {
    set: jest.Mock;
    markModified: jest.Mock;
    save: jest.Mock;
    $locals: Record<string, unknown>;
  };
  let contatos: { findById: jest.Mock };
  let tokens: {
    create: jest.Mock;
    findOne: jest.Mock;
    findOneAndUpdate: jest.Mock;
    updateOne: jest.Mock;
  };
  let servico: AtualizacaoCadastroService;

  beforeAll(() => {
    process.env.CIFRA_CHAVE_BASE64 = randomBytes(32).toString('base64');
    process.env.CIFRA_PEPPER = randomBytes(32).toString('hex');
  });

  beforeEach(() => {
    contato = {
      _id: contatoId,
      nome: 'Ana',
      emails: [{ valor: 'ana@exemplo.test', principal: true }],
      telefones: [{ e164: '+5511999999999', principal: true }],
      enderecos: [{ cidade: 'São Paulo', uf: 'SP' }],
      status: 'capturado',
      versao: 1,
      $locals: {},
      set: jest.fn((valores: Record<string, unknown>) => Object.assign(contato, valores)),
      markModified: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
    };
    contatos = {
      findById: jest.fn(() => ({
        lean: jest.fn().mockResolvedValue(contato),
        then: (resolver: (valor: unknown) => unknown) => Promise.resolve(contato).then(resolver),
      })),
    };
    const bruto = 'link-pessoal';
    const registro = {
      _id: token,
      tokenHash: createHash('sha256').update(bruto).digest('hex'),
      contatoId,
      emitidoPor: new Types.ObjectId(usuario.id),
      criadoEm: new Date(),
      expiraEm: new Date(Date.now() + 60_000),
      usadoEm: null,
    };
    tokens = {
      create: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(registro) })),
      findOneAndUpdate: jest.fn().mockResolvedValue(registro),
      updateOne: jest.fn().mockResolvedValue(undefined),
    };
    servico = new AtualizacaoCadastroService(contatos as never, tokens as never);
  });

  it('emite somente token hash e atualiza o mesmo contato uma única vez', async () => {
    const emitido = await servico.emitir(String(contatoId), usuario);
    expect(emitido.caminho).toMatch(/^\/atualizar-cadastro\//);
    expect(tokens.create.mock.calls[0][0].tokenHash).not.toBe(emitido.token);

    const lido = await servico.ler('link-pessoal');
    expect(lido).toMatchObject({ nome: 'Ana', cidade: 'São Paulo', uf: 'SP' });

    await expect(
      servico.atualizar('link-pessoal', { nome: 'Ana Silva', cidade: 'Santo André', uf: 'sp' }),
    ).resolves.toEqual({ atualizado: true });
    expect(contato.set).toHaveBeenCalledWith(expect.objectContaining({ nome: 'Ana Silva' }));
    expect(contato.$locals.autorNome).toBe('atualização pelo titular');
    expect(contato.save).toHaveBeenCalledTimes(1);
    expect(tokens.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ usadoEm: null }),
      expect.anything(),
      expect.anything(),
    );
    tokens.findOneAndUpdate.mockResolvedValueOnce(null);
    await expect(servico.atualizar('link-pessoal', {})).rejects.toThrow(
      'Este link expirou ou já foi usado',
    );
  });

  it('estúdio completa CNPJ, razão social e endereço pelo link', async () => {
    await servico.atualizar('link-pessoal', {
      tipoPessoa: 'PJ',
      cnpj: '11.222.333/0001-81',
      razaoSocial: 'estudio ana tattoo ltda',
      nomeFantasia: 'Ana Tattoo',
      cep: '01310-100',
      logradouro: 'Avenida Paulista',
      numero: '1000',
      complemento: 'sala 2',
      bairro: 'Bela Vista',
      cidade: 'São Paulo',
      uf: 'sp',
    });
    const gravado = contato.set.mock.calls[0][0] as Record<string, unknown>;
    expect(gravado.tipoPessoa).toBe('PJ');
    expect(gravado['pj.cnpjHash']).toEqual(expect.any(String));
    expect(gravado['pj.cnpjMascarado']).toBe('**.222.333/0001-**');
    expect(gravado['pj.cnpjCifrado']).not.toContain('11222333000181');
    expect(gravado['pj.nomeFantasia']).toBe('Ana Tattoo');
    expect(gravado.enderecos).toEqual([
      {
        cep: '01310100',
        logradouro: 'Avenida Paulista',
        numero: '1000',
        complemento: 'sala 2',
        bairro: 'Bela Vista',
        cidade: 'São Paulo',
        uf: 'SP',
      },
    ]);
    expect((gravado.completude as { score: number }).score).toBeGreaterThan(0);
  });

  it('CNPJ inválido volta para corrigir sem gastar o link', async () => {
    await expect(
      servico.atualizar('link-pessoal', { tipoPessoa: 'PJ', cnpj: '11.222.333/0001-00' }),
    ).rejects.toThrow('Este CNPJ não é válido');
    expect(tokens.findOneAndUpdate).not.toHaveBeenCalled();
    expect(contato.save).not.toHaveBeenCalled();
  });

  it('documento em branco mantém o que já existe e a leitura só mostra a máscara', async () => {
    contato.pj = { cnpjHash: 'hash', cnpjCifrado: 'segredo', cnpjMascarado: '**.222.333/0001-**' };
    const lido = await servico.ler('link-pessoal');
    expect(lido.cnpjMascarado).toBe('**.222.333/0001-**');
    expect(JSON.stringify(lido)).not.toContain('segredo');
    await servico.atualizar('link-pessoal', { cnpj: '  ', cidade: 'Santos' });
    const gravado = contato.set.mock.calls[0][0] as Record<string, unknown>;
    expect(gravado['pj.cnpjCifrado']).toBeUndefined();
  });

  it('CNPJ de outro cadastro devolve o link e explica', async () => {
    contato.save.mockRejectedValueOnce({ code: 11000, keyPattern: { 'pj.cnpjHash': 1 } });
    await expect(servico.atualizar('link-pessoal', { cnpj: '11.222.333/0001-81' })).rejects.toThrow(
      'Este CNPJ já está em outro cadastro',
    );
    expect(tokens.updateOne).toHaveBeenCalledWith(expect.anything(), {
      $set: { usadoEm: null },
    });
  });
});
