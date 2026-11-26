import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PaginaAtualizacaoCadastro } from './PaginaAtualizacaoCadastro';

function abrir() {
  render(
    <MemoryRouter initialEntries={['/atualizar-cadastro/abc']}>
      <Routes>
        <Route path="/atualizar-cadastro/:token" element={<PaginaAtualizacaoCadastro />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('link para completar o cadastro', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('estúdio completa CNPJ e endereço pelo CEP e envia só os campos de empresa', async () => {
    const fetchMock = vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
      const url = String(entrada);
      if (url.includes('viacep'))
        return {
          ok: true,
          json: async () => ({
            logradouro: 'Avenida Paulista',
            bairro: 'Bela Vista',
            localidade: 'São Paulo',
            uf: 'SP',
          }),
        };
      if (init?.method === 'POST') return { ok: true, json: async () => ({ atualizado: true }) };
      return {
        ok: true,
        json: async () => ({
          tipoPessoa: '',
          nome: 'Ana',
          telefone: '+5511987654321',
          email: '',
          cnpjMascarado: '',
          expiraEm: '2026-12-03T00:00:00.000Z',
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);
    abrir();

    fireEvent.change(await screen.findByLabelText('CNPJ'), {
      target: { value: '11.222.333/0001-81' },
    });
    fireEvent.change(screen.getByLabelText('Razão social'), {
      target: { value: 'Ana Tattoo Ltda' },
    });
    fireEvent.change(screen.getByLabelText('CEP'), { target: { value: '01310-100' } });
    await waitFor(() =>
      expect(screen.getByLabelText<HTMLInputElement>('Rua / avenida').value).toBe(
        'Avenida Paulista',
      ),
    );
    fireEvent.change(screen.getByLabelText('Número'), { target: { value: '1000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar cadastro' }));

    expect(await screen.findByText('Cadastro atualizado')).toBeTruthy();
    const envio = fetchMock.mock.calls.find((chamada) => chamada[1]?.method === 'POST');
    const corpo = JSON.parse(String(envio?.[1]?.body)) as Record<string, string>;
    expect(corpo).toMatchObject({
      tipoPessoa: 'PJ',
      cnpj: '11.222.333/0001-81',
      razaoSocial: 'Ana Tattoo Ltda',
      cep: '01310-100',
      logradouro: 'Avenida Paulista',
      numero: '1000',
      cidade: 'São Paulo',
      uf: 'SP',
    });
    expect(corpo).not.toHaveProperty('cpf');
    expect(corpo).not.toHaveProperty('expiraEm');
  });

  it('mostra só a máscara do documento já gravado e o erro do servidor', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_entrada: RequestInfo | URL, init?: RequestInit) =>
        init?.method === 'POST'
          ? {
              ok: false,
              json: async () => ({ mensagem: 'Este CNPJ não é válido. Confira os números.' }),
            }
          : {
              ok: true,
              json: async () => ({ tipoPessoa: 'PJ', cnpjMascarado: '**.222.333/0001-**' }),
            },
      ),
    );
    abrir();
    expect(await screen.findByText(/Já temos o CNPJ \*\*\.222\.333\/0001-\*\*/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar cadastro' }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Este CNPJ não é válido. Confira os números.',
    );
    expect(screen.getByRole('button', { name: 'Enviar cadastro' })).toBeTruthy();
  });
});
