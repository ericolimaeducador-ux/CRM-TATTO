import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PaginaPromover } from './PaginaPromover';

describe('tela de promoção', () => {
  it('explica o campo obrigatório e não fala em salvo genérico', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ dados: { nome: 'Ana', status: 'qualificado' } }),
      })),
    );
    render(
      <MemoryRouter initialEntries={['/promover/abc']}>
        <Routes>
          <Route path="/promover/:id" element={<PaginaPromover />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText(/única tela com campo obrigatório/)).toBeTruthy();
    expect(screen.getByLabelText(/Código TOTP obrigatório/).hasAttribute('required')).toBe(true);
    expect(screen.queryByText(/^salvo$/i)).toBeNull();
  });
});
