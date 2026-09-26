import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PaginaMerge } from './PaginaMerge';

describe('tela de merge', () => {
  it('resume o efeito, não pergunta tem certeza e deixa a fusão clicável', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => ({
        ok: true,
        json: async () => ({
          dados: {
            nome: String(url).endsWith('/b') ? 'Contato B' : 'Contato A',
            emails: [{ valor: 'a@exemplo.com' }],
          },
        }),
      })),
    );
    render(
      <MemoryRouter initialEntries={['/merge/a/b']}>
        <Routes>
          <Route path="/merge/:a/:b" element={<PaginaMerge />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText(/B será descartado e recuperável por 90 dias/)).toBeTruthy();
    expect(screen.queryByText(/tem certeza/i)).toBeNull();
    const botao = screen.getByRole('button', { name: 'Fundir com esta escolha' });
    expect(botao.hasAttribute('disabled')).toBe(false);
  });

  it('envia o código digitado e não manda o cabeçalho de teste', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      json: async () => ({ dados: { nome: 'Contato A' } }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    render(
      <MemoryRouter initialEntries={['/merge/a/b']}>
        <Routes>
          <Route path="/merge/:a/:b" element={<PaginaMerge />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.change(await screen.findByLabelText(/Código TOTP/), { target: { value: '654321' } });
    fireEvent.click(screen.getByRole('button', { name: 'Fundir com esta escolha' }));
    await screen.findByText('O contato B foi descartado e pode ser recuperado por 90 dias.');
    const chamada = fetchMock.mock.calls.find((item) => String(item[0]).includes('/merge'));
    const init = chamada?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['x-step-up-teste']).toBeUndefined();
    expect(JSON.parse(String(init.body)).codigoTotp).toBe('654321');
  });
});
