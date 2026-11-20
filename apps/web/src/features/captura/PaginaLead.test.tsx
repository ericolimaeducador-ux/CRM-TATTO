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
    expect((await screen.findAllByText(/Elisa Souza/)).length).toBeGreaterThan(0);
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

describe('ficha do lead', () => {
  function montar(dados: Record<string, unknown>, papel = 'admin') {
    localStorage.setItem('captura7.perfil', JSON.stringify({ id: '1', papel, nome: 'Admin' }));
    const fetchMock = vi.fn(async (_entrada: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        const corpo = JSON.parse(String(init.body)) as { campo: string; valor: string };
        return {
          ok: true,
          json: async () => ({ dados: { ...dados, versao: 2, [corpo.campo]: corpo.valor } }),
        };
      }
      return { ok: true, json: async () => ({ dados }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    render(
      <MemoryRouter initialEntries={['/lead/abc']}>
        <Routes>
          <Route path="/lead/:id" element={<PaginaLead />} />
        </Routes>
      </MemoryRouter>,
    );
    return fetchMock;
  }

  const gabriel = {
    nome: 'Gabriel Dias',
    status: 'rascunho',
    versao: 1,
    tipoPessoa: 'INDEFINIDO',
    emails: [{ valor: 'gabriel@exemplo.com' }],
    telefones: [{ e164: '+5511987654321', bruto: '11987654321' }],
    origem: { modo: 'qr_proprio' },
    lgpd: { contatoComercial: 'concedido' },
  };

  it('mostra os dados do autocadastro e só as ações válidas para rascunho', async () => {
    montar(gabriel);
    const dados = await screen.findByTestId('dados-lead');
    expect(dados.textContent).toContain('gabriel@exemplo.com');
    expect(dados.textContent).toContain('+5511987654321');
    expect(dados.textContent).toContain('Autocadastro pelo QR');
    expect(screen.getByRole('button', { name: 'Marcar como capturado' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Qualificar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reabrir como rascunho' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reabrir como capturado' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Promover a cliente' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Descartar' })).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/captura7/i);
  });

  it('oferece qualificar para capturado e promover só para qualificado', async () => {
    montar({ ...gabriel, status: 'capturado' });
    expect(await screen.findByRole('button', { name: 'Qualificar' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Promover a cliente' })).toBeNull();
  });

  it('edita o telefone pela API com a versão conhecida', async () => {
    const fetchMock = montar(gabriel);
    fireEvent.click(await screen.findByRole('button', { name: 'Editar dados' }));
    fireEvent.change(screen.getByLabelText('Telefone'), { target: { value: '11900001111' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar dados' }));
    await screen.findByText('Dados salvos.');
    const patch = fetchMock.mock.calls.find((chamada) => chamada[1]?.method === 'PATCH');
    expect(JSON.parse(String(patch?.[1]?.body))).toEqual({
      campo: 'telefone',
      valor: '11900001111',
      versaoConhecida: 1,
    });
    expect(fetchMock.mock.calls.filter((chamada) => chamada[1]?.method === 'PATCH')).toHaveLength(
      1,
    );
  });

  it('auditor vê os dados mas não edita', async () => {
    montar(gabriel, 'auditor');
    await screen.findByTestId('dados-lead');
    expect(screen.queryByRole('button', { name: 'Editar dados' })).toBeNull();
  });
});
