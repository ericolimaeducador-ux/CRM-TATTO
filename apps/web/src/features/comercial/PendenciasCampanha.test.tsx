import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PendenciasDeCampanha } from './PendenciasCampanha';

describe('contatos que ficam de fora das campanhas', () => {
  it('mostra motivo, como resolver, link da ficha e filtra por motivo', async () => {
    localStorage.setItem(
      'captura7.perfil',
      JSON.stringify({ id: '1', papel: 'gestor', nome: 'Gestor' }),
    );
    const fetchMock = vi.fn(async (entrada: RequestInfo | URL) => ({
      ok: true,
      status: 200,
      json: async () => ({
        registros: [
          {
            id: 'a1',
            nome: 'Bruna Ink',
            status: 'capturado',
            origem: 'manual',
            criadoEm: '2026-11-20T15:00:00Z',
            motivo: 'sem_telefone_valido',
            contatoComercial: 'concedido',
            telefoneRegistrado: '8 dígitos, final 1234',
          },
        ],
        total: String(entrada).includes('motivo=') ? 1 : 3,
        pagina: 1,
        limite: 30,
        contagem: { sem_telefone_valido: 1, sem_autorizacao_documentada: 2 },
        elegiveis: 10,
        analisados: 13,
        truncado: false,
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    render(
      <MemoryRouter>
        <PendenciasDeCampanha />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Bruna Ink')).toBeTruthy();
    expect(screen.getByText(/8 dígitos, final 1234/)).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Abrir ficha para ajustar' }).getAttribute('href'),
    ).toBe('/lead/a1');
    expect(screen.getByRole('button', { name: 'Todos (3)' })).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: /Sem telefone válido para WhatsApp \(1\)/ }),
    );
    await screen.findByText(/corrija o telefone com DDD/);
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain('motivo=sem_telefone_valido');
  });
});
