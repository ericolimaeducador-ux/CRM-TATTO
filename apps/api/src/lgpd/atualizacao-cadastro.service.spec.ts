import { createHash } from 'node:crypto';
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
});
