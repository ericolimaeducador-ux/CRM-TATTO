import { AuthService } from './auth.service';
import { hashSenha } from './senha';

describe('sessões vigentes e limite de autenticação', () => {
  it('aplica rebaixamento e desativação à sessão já emitida', async () => {
    const usuario = { papel: 'gestor', nome: 'Representante', ativo: true };
    const usuarios = { findById: jest.fn(() => ({ lean: async () => usuario })) };
    const sessoes = {
      findOne: jest.fn(() => ({
        lean: async () => ({
          usuarioId: '507f1f77bcf86cd799439011',
          papel: 'admin',
          nome: 'Antigo',
          expiraEm: new Date(Date.now() + 60_000),
        }),
      })),
    };
    const totp = { inscrito: jest.fn(async () => true) };
    const service = new AuthService(
      usuarios as never,
      sessoes as never,
      {} as never,
      totp as never,
    );
    expect((await service.validar('token'))?.papel).toBe('gestor');
    usuario.papel = 'vendedor';
    expect((await service.validar('token'))?.papel).toBe('vendedor');
    usuario.ativo = false;
    expect(await service.validar('token')).toBeNull();
  });

  it('senha correta não zera o limite de códigos TOTP incorretos', async () => {
    const senhaHash = await hashSenha('senha-qa-suficientemente-longa');
    const usuario = { _id: '507f1f77bcf86cd799439012', nome: 'QA', papel: 'vendedor', senhaHash };
    const usuarios = { findOne: jest.fn(() => ({ lean: async () => usuario })) };
    const sessoes = { create: jest.fn(async () => ({})) };
    const totp = {
      inscrito: jest.fn(async () => true),
      confirmar: jest.fn(async () => ({
        aceito: false,
        codigo: 'STEP_UP_NECESSARIO',
        mensagem: 'Inválido',
      })),
    };
    const service = new AuthService(
      usuarios as never,
      sessoes as never,
      {} as never,
      totp as never,
    );
    const login = 'qa-limite-totp';
    await expect(service.entrar(login, 'senha-qa-suficientemente-longa')).rejects.toMatchObject({
      codigo: 'TOTP_OBRIGATORIO',
    });
    for (let tentativa = 0; tentativa < 8; tentativa += 1) {
      await expect(
        service.entrar(login, 'senha-qa-suficientemente-longa', '000000'),
      ).rejects.toMatchObject({ codigo: 'STEP_UP_NECESSARIO' });
    }
    await expect(
      service.entrar(login, 'senha-qa-suficientemente-longa', '000000'),
    ).rejects.toMatchObject({ codigo: 'LOGIN_BLOQUEADO' });
    expect(totp.confirmar).toHaveBeenCalledTimes(8);
    expect(sessoes.create).not.toHaveBeenCalled();
  });
});
