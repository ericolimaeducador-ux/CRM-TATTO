import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PaginaUsuarios } from './PaginaUsuarios';

function respostaJson(ok: boolean, json: unknown) {
  return { ok, status: ok ? 200 : 422, json: async () => json };
}

describe('página de usuários', () => {
  it('mostra o resultado logo abaixo de Criar usuário e mantém os campos no erro', async () => {
    const lista = [{ id: '1', login: 'ana', nome: 'Ana', papel: 'vendedor', ativo: true }];
    let criacoes = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          criacoes += 1;
          return criacoes === 1
            ? respostaJson(false, { erros: [{ mensagem: 'Senha curta demais.' }] })
            : respostaJson(true, { dados: { id: '2' } });
        }
        return respostaJson(true, { dados: lista });
      }),
    );
    render(<PaginaUsuarios />);
    await screen.findByText(/Ana \(ana\)/);
    const login = screen.getByLabelText('Login') as HTMLInputElement;
    const senha = screen.getByLabelText(/Senha/) as HTMLInputElement;
    const nome = screen.getByLabelText('Nome') as HTMLInputElement;
    fireEvent.change(login, { target: { value: 'bia' } });
    fireEvent.change(senha, { target: { value: 'curta' } });
    fireEvent.change(nome, { target: { value: 'Bia' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar usuário' }));
    const aviso = await screen.findByTestId('mensagem-criacao');
    expect(aviso.textContent).toBe('Senha curta demais.');
    const botao = screen.getByRole('button', { name: 'Criar usuário' });
    expect(botao.compareDocumentPosition(aviso) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const itemLista = screen.getByText(/Ana \(ana\)/);
    expect(
      aviso.compareDocumentPosition(itemLista) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(login.value).toBe('bia');
    expect(senha.value).toBe('curta');
    expect(nome.value).toBe('Bia');
    fireEvent.click(botao);
    await waitFor(() =>
      expect(screen.getByTestId('mensagem-criacao').textContent).toContain('Usuário criado'),
    );
    expect(login.value).toBe('');
    expect(document.body.textContent).not.toMatch(/captura7/i);
  });
});
