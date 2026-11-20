import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PaginaUsuarios } from './PaginaUsuarios';

function abrir(papel = 'admin') {
  localStorage.setItem('captura7.perfil', JSON.stringify({ id: 'abc', papel, nome: 'Admin QA' }));
  localStorage.setItem('captura7.token', 'tok-admin');
  return render(
    <MemoryRouter>
      <PaginaUsuarios />
    </MemoryRouter>,
  );
}

beforeEach(() => localStorage.clear());

describe('administração da equipe', () => {
  it('cria membro com perfil legível e impede criação duplicada', async () => {
    let concluir!: (value: unknown) => void;
    const fetchMock = vi.fn((_url: RequestInfo | URL, init?: RequestInit): Promise<unknown> => {
      if (init?.method === 'POST')
        return new Promise((resolve) => {
          concluir = resolve;
        });
      return Promise.resolve({ ok: true, json: async () => ({ dados: [] }) });
    });
    vi.stubGlobal('fetch', fetchMock);
    abrir();
    await screen.findByRole('button', { name: 'Atualizar lista' });
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Ana QA' } });
    fireEvent.change(screen.getByLabelText('Usuário'), { target: { value: 'ana-qa' } });
    fireEvent.change(screen.getByLabelText('Senha de 12 caracteres ou mais'), {
      target: { value: 'senha-longa-para-qa' },
    });
    fireEvent.change(screen.getByLabelText('Perfil', { exact: true }), {
      target: { value: 'admin' },
    });
    expect(screen.getByRole('option', { name: 'Administrador' })).toBeTruthy();
    const formulario = screen.getByRole('button', { name: 'Criar usuário' }).closest('form')!;
    fireEvent.submit(formulario);
    fireEvent.submit(formulario);
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
    concluir({ ok: true, json: async () => ({ dados: { id: 'nova' } }) });
    await screen.findByText(/Usuário criado\. Entregue/);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/v1/usuarios'),
      expect.objectContaining({
        body: JSON.stringify({
          login: 'ana-qa',
          senha: 'senha-longa-para-qa',
          nome: 'Ana QA',
          papel: 'admin',
        }),
        headers: expect.objectContaining({ authorization: 'Bearer tok-admin' }),
      }),
    );
    expect(
      (screen.getByLabelText('Senha de 12 caracteres ou mais') as HTMLInputElement).value,
    ).toBe('');
  });

  it('explica falha de rede e permite atualizar a lista', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ ok: true, json: async () => ({ dados: [] }) });
    vi.stubGlobal('fetch', fetchMock);
    abrir();
    await screen.findByText(
      'Não consegui carregar os usuários. Confira sua conexão e atualize a lista.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar lista' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it('não oferece gestão nem consulta usuários para perfil vendedor', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    abrir('vendedor');
    expect(
      screen.getByText('Entre com um perfil de administrador para gerenciar a equipe.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Criar usuário' })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
