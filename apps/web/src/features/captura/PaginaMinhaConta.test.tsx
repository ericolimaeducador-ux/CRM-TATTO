import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PaginaMinhaConta } from './PaginaMinhaConta';

function abrir(papel = 'admin') {
  localStorage.setItem('captura7.token', 'tok-conta');
  localStorage.setItem('captura7.perfil', JSON.stringify({ id: 'abc', papel, nome: 'Pessoa QA' }));
  return render(
    <MemoryRouter>
      <PaginaMinhaConta />
    </MemoryRouter>,
  );
}

beforeEach(() => localStorage.clear());

describe('minha conta separada da entrada', () => {
  it('exporta com o token e confirma operações sensíveis em campo próprio', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({}),
      blob: async () => new Blob(['nome\nAna']),
    }));
    vi.stubGlobal('fetch', fetchMock);
    URL.createObjectURL = () => 'blob:leads';
    URL.revokeObjectURL = () => undefined;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    abrir();
    expect(screen.getByRole('link', { name: 'Gerenciar usuários' }).getAttribute('href')).toBe(
      '/usuarios',
    );
    fireEvent.click(screen.getByText('Importar e exportar planilhas'));
    fireEvent.click(screen.getByRole('button', { name: 'Baixar CSV' }));
    await screen.findByText('Arquivo CSV baixado.');
    fireEvent.click(screen.getByText('Confirmar operações sensíveis'));
    fireEvent.change(screen.getByLabelText('Código do autenticador'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar passo extra' }));
    await screen.findByText('Passo extra confirmado por cinco minutos.');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/v1/exportacoes'),
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: 'Bearer tok-conta' }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/v1/auth/step-up'),
      expect.objectContaining({ body: JSON.stringify({ codigoTotp: '123456' }) }),
    );
  });

  it('gestor importa XLSX com sessão e não recebe exportação administrativa', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ dados: { importados: 1, duplicatas: 0 } }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    abrir('gestor');
    fireEvent.click(screen.getByText('Importar e exportar planilhas'));
    expect(screen.queryByRole('button', { name: 'Baixar CSV' })).toBeNull();
    fireEvent.change(screen.getByLabelText('Arquivo CSV ou XLSX'), {
      target: { files: [new File([new Uint8Array([1, 2, 3])], 'leads.xlsx')] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Importar planilha' }));
    await screen.findByText(/Novos: 1/);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/v1/importacoes'),
      expect.objectContaining({ body: JSON.stringify({ xlsxBase64: 'AQID' }) }),
    );
  });

  it('vendedor encerra sessão local e no servidor sem receber gestão ou planilhas', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    abrir('vendedor');
    expect(screen.queryByText('Importar e exportar planilhas')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Gerenciar usuários' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));
    await screen.findByText('Sessão encerrada neste aparelho e no servidor.');
    expect(localStorage.getItem('captura7.token')).toBeNull();
    expect(localStorage.getItem('captura7.perfil')).toBeNull();
    expect(screen.getByRole('link', { name: 'Entrar no Tela Viva' })).toBeTruthy();
  });
});
