import { fireEvent, render, screen } from '@testing-library/react';
import { PaginaEntrar } from './PaginaEntrar';

describe('entrada do administrador', () => {
  it('guarda o token e pede a exportação com o mesmo token', async () => {
    localStorage.clear();
    const fetchMock = vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
      const url = String(entrada);
      if (url.endsWith('/v1/auth/entrar')) {
        return {
          ok: true,
          json: async () => ({
            dados: { token: 'tok-admin', usuario: { id: 'abc', papel: 'admin', nome: 'Erico' } },
          }),
        };
      }
      return {
        ok: true,
        blob: async () => new Blob(['nome\nAna']),
        json: async () => ({}),
        headers: init?.headers,
      };
    });
    vi.stubGlobal('fetch', fetchMock);
    URL.createObjectURL = () => 'blob:leads';
    URL.revokeObjectURL = () => undefined;
    HTMLAnchorElement.prototype.click = () => undefined;
    render(<PaginaEntrar />);
    fireEvent.change(screen.getByLabelText('Usuário'), { target: { value: 'erico' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha-bem-longa' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('Entrou como Erico.')).toBeTruthy();
    expect(localStorage.getItem('captura7.token')).toBe('tok-admin');
    expect(JSON.parse(localStorage.getItem('captura7.perfil') ?? '{}').papel).toBe('admin');
    fireEvent.click(screen.getByRole('button', { name: 'Baixar CSV' }));
    await screen.findByText('Arquivo CSV baixado.');
    const chamada = fetchMock.mock.calls.find((item) =>
      String(item[0]).includes('/v1/exportacoes'),
    );
    const cabecalhos = chamada?.[1]?.headers as Record<string, string>;
    expect(cabecalhos.authorization).toBe('Bearer tok-admin');
  });
});
