import { render, screen } from '@testing-library/react';
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
});
