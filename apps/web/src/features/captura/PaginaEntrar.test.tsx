import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PaginaEntrar } from './PaginaEntrar';

function montar() {
  return render(
    <MemoryRouter>
      <PaginaEntrar />
    </MemoryRouter>,
  );
}

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
    montar();
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

  it('esconde exportação do vendedor, envia XLSX e encerra a sessão', async () => {
    localStorage.clear();
    const fetchMock = vi.fn(async (entrada: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(entrada);
      if (url.endsWith('/v1/auth/entrar')) {
        return {
          ok: true,
          json: async () => ({
            dados: { token: 'tok-vend', usuario: { id: 'v', papel: 'vendedor', nome: 'Lia' } },
          }),
        };
      }
      if (url.endsWith('/v1/auth/sair')) return { ok: true, json: async () => ({ dados: {} }) };
      return { ok: true, json: async () => ({ dados: { importados: 0, duplicatas: 0 } }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    const { unmount } = montar();
    fireEvent.change(screen.getByLabelText('Usuário'), { target: { value: 'lia' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha-bem-longa' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('Entrou como Lia.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Baixar CSV' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Inscrever autenticador' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));
    expect(await screen.findByText(/Sessão encerrada/)).toBeTruthy();
    expect(localStorage.getItem('captura7.token')).toBeNull();
    unmount();

    localStorage.clear();
    fetchMock.mockImplementation(async (entrada: RequestInfo | URL, init?: RequestInit) => {
      const url = String(entrada);
      if (url.endsWith('/v1/auth/entrar')) {
        return {
          ok: true,
          json: async () => ({
            dados: { token: 'tok-gestor', usuario: { id: 'g', papel: 'gestor', nome: 'Guto' } },
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({ dados: { importados: 1, duplicatas: 0 } }),
        text: async () => String(init?.body ?? ''),
      };
    });
    montar();
    fireEvent.change(screen.getByLabelText('Usuário'), { target: { value: 'guto' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha-bem-longa' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('Entrou como Guto.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Baixar CSV' })).toBeNull();
    const arquivo = new File([new Uint8Array([1, 2, 3])], 'leads.xlsx');
    fireEvent.change(screen.getByLabelText('Arquivo CSV ou XLSX'), {
      target: { files: [arquivo] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Importar planilha' }));
    expect(await screen.findByText(/Novos: 1/)).toBeTruthy();
    const envio = fetchMock.mock.calls.find((item) => String(item[0]).includes('/v1/importacoes'));
    expect(String(envio?.[1]?.body)).toContain('xlsxBase64');
  });

  it('no primeiro acesso fica na tela e mostra a inscrição logo abaixo do botão', async () => {
    localStorage.clear();
    const segredo = 'JBSWY3DPEHPK3PXP';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (entrada: RequestInfo | URL) => {
        const url = String(entrada);
        if (url.endsWith('/v1/auth/entrar')) {
          return {
            ok: true,
            json: async () => ({
              dados: {
                token: 'tok-novo',
                precisaInscreverTotp: true,
                usuario: { id: 'abc', papel: 'admin', nome: 'Erico' },
              },
            }),
          };
        }
        return {
          ok: true,
          json: async () => ({
            dados: {
              segredoBase32: segredo,
              otpauth: `otpauth://totp/TattooArt:erico?secret=${segredo}&issuer=TattooArt&digits=6&period=30`,
              pendente: true,
            },
          }),
        };
      }),
    );
    render(
      <MemoryRouter initialEntries={['/entrar']}>
        <Routes>
          <Route path="/entrar" element={<PaginaEntrar />} />
          <Route path="/cadastros" element={<p>tela de cadastros</p>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText('Usuário'), { target: { value: 'erico' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha-bem-longa' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('Entrou como Erico.')).toBeTruthy();
    expect(screen.queryByText('tela de cadastros')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Trocar senha' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Inscrever autenticador' }));
    const titulo = await screen.findByRole('heading', {
      name: 'Cadastre o TattooArt no seu autenticador',
    });
    const sair = screen.getByRole('button', { name: 'Sair' });
    // A chave aparece antes do Sair, não solta no fim da página.
    expect(titulo.compareDocumentPosition(sair) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByTestId('segredo-totp')).toHaveLength(1);
    expect(screen.getByTestId('segredo-totp').textContent).toBe('JBSW Y3DP EHPK 3PXP');
  });
});
