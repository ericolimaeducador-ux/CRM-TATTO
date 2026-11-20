import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PaginaEntrar } from './PaginaEntrar';

function abrir() {
  return render(
    <MemoryRouter initialEntries={['/entrar']}>
      <Routes>
        <Route path="/entrar" element={<PaginaEntrar />} />
        <Route path="/" element={<h1>Painel do CRM</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

function preencher() {
  fireEvent.change(screen.getByLabelText('Usuário'), { target: { value: 'erico' } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha-bem-longa' } });
}

beforeEach(() => localStorage.clear());

describe('entrada simples', () => {
  it('envia somente usuário/senha, limpa pendência antiga e abre o painel', async () => {
    localStorage.setItem('captura7.totpPendente', '1');
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        dados: { token: 'tok-admin', usuario: { id: 'abc', papel: 'admin', nome: 'Erico' } },
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    abrir();
    expect(screen.queryByLabelText(/autenticador/i)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Baixar CSV' })).toBeNull();
    preencher();
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('Painel do CRM')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/v1/auth/entrar'),
      expect.objectContaining({
        body: JSON.stringify({ login: 'erico', senha: 'senha-bem-longa' }),
      }),
    );
    expect(localStorage.getItem('captura7.token')).toBe('tok-admin');
    expect(JSON.parse(localStorage.getItem('captura7.perfil') ?? '{}').papel).toBe('admin');
    expect(localStorage.getItem('captura7.totpPendente')).toBeNull();
  });

  it('mostra e oculta a senha sem submeter o formulário', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    abrir();
    expect(screen.getByLabelText('Senha').getAttribute('type')).toBe('password');
    fireEvent.click(screen.getByLabelText('Mostrar senha'));
    expect(screen.getByLabelText('Senha').getAttribute('type')).toBe('text');
    fireEvent.click(screen.getByLabelText('Mostrar senha'));
    expect(screen.getByLabelText('Senha').getAttribute('type')).toBe('password');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['credencial', 'rede'])('explica falha de %s e permite nova tentativa', async (tipo) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        if (tipo === 'rede') throw new Error('offline');
        return {
          ok: false,
          json: async () => ({ erros: [{ mensagem: 'Usuário ou senha não conferem.' }] }),
        };
      }),
    );
    abrir();
    preencher();
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    // Na falha de rede aparece antes o aviso de servidor acordando; espera a mensagem final.
    await waitFor(
      () =>
        expect(screen.getByRole('alert').textContent).toContain(
          tipo === 'rede' ? 'Confira sua conexão' : 'Usuário ou senha',
        ),
      { timeout: 3000 },
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Entrar' }).hasAttribute('disabled')).toBe(false),
    );
    expect(localStorage.getItem('captura7.token')).toBeNull();
  });

  it('impede envio duplicado enquanto aguarda a API', () => {
    const fetchMock = vi.fn(() => new Promise(() => undefined));
    vi.stubGlobal('fetch', fetchMock);
    abrir();
    preencher();
    const formulario = screen.getByRole('button', { name: 'Entrar' }).closest('form')!;
    fireEvent.submit(formulario);
    fireEvent.submit(formulario);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
