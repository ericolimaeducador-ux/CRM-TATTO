import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PaginaCadastros } from './PaginaCadastros';

describe('cadastros do servidor', () => {
  it('mostra a lista da API com documento mascarado', async () => {
    localStorage.setItem(
      'captura7.perfil',
      JSON.stringify({ id: '1', papel: 'admin', nome: 'Erico' }),
    );
    localStorage.setItem('captura7.token', 'tok');
    const fetchMock = vi.fn(async (entrada: RequestInfo | URL) => {
      expect(String(entrada)).toContain('/v1/contatos');
      return {
        ok: true,
        json: async () => ({
          dados: [
            {
              _id: 'abc',
              nome: 'Ana Lista',
              status: 'capturado',
              tipoPessoa: 'PF',
              pf: { cpfMascarado: '***.982.247-**' },
              lgpd: { contatoComercial: 'concedido' },
              origem: { modo: 'manual' },
            },
          ],
          proximoCursor: null,
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);
    render(
      <MemoryRouter>
        <PaginaCadastros />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('link', { name: 'Ana Lista' })).toBeTruthy();
    expect(screen.getByText('***.982.247-**')).toBeTruthy();
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain('IndexedDB');
  });
});
