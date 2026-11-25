import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PaginaPromover } from './PaginaPromover';

describe('tela de promoção', () => {
  it('explica o campo obrigatório e não fala em salvo genérico', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          dados: {
            nome: 'Ana',
            status: 'qualificado',
            pf: { cpfMascarado: '***.***.***-25' },
            enderecos: [{ logradouro: 'Rua A', numero: '1', cidade: 'SP', uf: 'SP' }],
          },
        }),
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

  it('sem os dados de cliente, explica o que falta e não pede o código', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ dados: { nome: 'Teste Sem Dados', status: 'capturado' } }),
      })),
    );
    render(
      <MemoryRouter initialEntries={['/promover/abc']}>
        <Routes>
          <Route path="/promover/:id" element={<PaginaPromover />} />
        </Routes>
      </MemoryRouter>,
    );
    const falta = await screen.findByLabelText('O que falta para virar cliente');
    expect(falta.textContent).toContain('estar qualificado');
    expect(falta.textContent).toContain('CPF ou CNPJ');
    expect(falta.textContent).toContain('endereço completo');
    expect(screen.queryByLabelText(/Código TOTP obrigatório/)).toBeNull();
    expect(
      screen.getByRole('link', { name: 'Abrir a ficha de Teste Sem Dados' }).getAttribute('href'),
    ).toBe('/lead/abc');
  });
});
