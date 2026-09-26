import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PaginaLead } from './PaginaLead';

describe('confirmação de revogação e eliminação', () => {
  it('não envia no primeiro toque e só elimina com ELIMINAR', async () => {
    localStorage.setItem(
      'captura7.perfil',
      JSON.stringify({ id: '1', papel: 'gestor', nome: 'Gestor' }),
    );
    const fetchMock = vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
      const url = String(entrada);
      if (init?.method === 'POST') {
        return { ok: true, json: async () => ({ dados: { nome: null, status: 'capturado' } }) };
      }
      return {
        ok: url.includes('/auditoria') ? false : true,
        json: async () => ({
          dados: {
            nome: 'Elisa Souza',
            status: 'capturado',
            lgpd: { contatoComercial: 'concedido' },
          },
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);
    render(
      <MemoryRouter initialEntries={['/lead/abc']}>
        <Routes>
          <Route path="/lead/:id" element={<PaginaLead />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText(/Elisa Souza/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Revogar consentimento' }));
    expect(fetchMock.mock.calls.some((chamada) => String(chamada[0]).includes('/revogacao'))).toBe(
      false,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar revogação' }));
    await screen.findByText('Consentimento revogado.');
    const revogacao = fetchMock.mock.calls.find((chamada) =>
      String(chamada[0]).includes('/revogacao'),
    );
    expect(JSON.parse(String(revogacao?.[1]?.body))).toEqual({ confirmar: true });

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar titular' }));
    const confirmar = screen.getByRole('button', { name: 'Confirmar eliminação' });
    expect((confirmar as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/ELIMINAR/), { target: { value: 'ELIMINAR' } });
    expect((confirmar as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(confirmar);
    await screen.findByText('Dados do titular eliminados.');
    const eliminacao = fetchMock.mock.calls.find((chamada) =>
      String(chamada[0]).includes('/eliminacao'),
    );
    expect(JSON.parse(String(eliminacao?.[1]?.body))).toEqual({ confirmacao: 'ELIMINAR' });
  });
});
