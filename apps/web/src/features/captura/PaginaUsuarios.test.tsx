import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { PaginaUsuarios } from './PaginaUsuarios';

// Dados falsos de exemplo; a chave é a do RFC 4226.
const SEGREDO = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
const otpauth = (login: string) =>
  `otpauth://totp/TattooArt:${login}?secret=${SEGREDO}&issuer=TattooArt&digits=6&period=30`;

const LISTA = [
  { id: 'eu', login: 'erico', nome: 'Erico', papel: 'admin', ativo: true },
  { id: 'v1', login: 'lia', nome: 'Lia', papel: 'vendedor', ativo: true },
  {
    id: 'a2',
    login: 'bia',
    nome: 'Bia',
    papel: 'admin',
    ativo: true,
    trocarSenhaObrigatoria: true,
  },
];

function responder(corpo: unknown, ok = true) {
  return { ok, json: async () => corpo };
}

function montarFetch() {
  const fetchMock = vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = String(entrada);
    const metodo = init?.method ?? 'GET';
    if (url.endsWith('/v1/usuarios') && metodo === 'GET') return responder({ dados: LISTA });
    if (url.endsWith('/v1/usuarios') && metodo === 'POST') {
      const corpo = JSON.parse(String(init?.body)) as {
        login: string;
        nome: string;
        papel: string;
      };
      return responder({
        dados: {
          id: 'novo',
          login: corpo.login,
          nome: corpo.nome,
          papel: corpo.papel,
          ativo: true,
          senhaProvisoria: 'Abcd-Efgh-Jkmn-Pqrs',
          senhaGerada: true,
          totp:
            corpo.papel === 'admin'
              ? { segredoBase32: SEGREDO, otpauth: otpauth(corpo.login) }
              : null,
        },
      });
    }
    if (url.endsWith('/senha/gerar')) {
      return responder({ dados: { id: 'v1', senhaProvisoria: 'Nova-Senh-Aprv-Isor' } });
    }
    if (url.endsWith('/totp/regenerar')) {
      return responder({
        dados: { id: 'a2', totp: { segredoBase32: SEGREDO, otpauth: otpauth('bia') } },
      });
    }
    return responder({ dados: {} });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(
    'captura7.perfil',
    JSON.stringify({ id: 'eu', papel: 'admin', nome: 'Erico' }),
  );
});

afterEach(() => cleanup());

describe('usuários: senha provisória e autenticador entregues pelo admin', () => {
  it('cria vendedor com senha gerada e sem autenticador', async () => {
    const fetchMock = montarFetch();
    render(<PaginaUsuarios />);
    await screen.findByText(/Lia \(lia\)/);
    fireEvent.change(screen.getByLabelText('Login'), { target: { value: 'caio' } });
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Caio' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar usuário' }));
    const cartao = await screen.findByRole('region', {
      name: 'Conta criada: entregue estes dados a Caio',
    });
    expect(within(cartao).getByTestId('senha-provisoria').textContent).toBe('Abcd-Efgh-Jkmn-Pqrs');
    expect(within(cartao).getByRole('button', { name: 'Copiar' })).toBeTruthy();
    expect(within(cartao).queryByTestId('segredo-totp')).toBeNull();
    const envio = fetchMock.mock.calls.find((item) => item[1]?.method === 'POST');
    expect(JSON.parse(String(envio?.[1]?.body))).toEqual({
      login: 'caio',
      nome: 'Caio',
      papel: 'vendedor',
    });
    fireEvent.click(within(cartao).getByRole('button', { name: 'Já entreguei, esconder' }));
    expect(screen.queryByTestId('senha-provisoria')).toBeNull();
  });

  it('cria admin e mostra o autenticador da conta para entregar', async () => {
    montarFetch();
    render(<PaginaUsuarios />);
    await screen.findByText(/Lia \(lia\)/);
    fireEvent.change(screen.getByLabelText('Login'), { target: { value: 'duda' } });
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Duda' } });
    fireEvent.change(screen.getByLabelText('Perfil'), { target: { value: 'admin' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar usuário' }));
    const cartao = await screen.findByRole('region', {
      name: 'Conta criada: entregue estes dados a Duda',
    });
    expect(
      within(cartao).getByRole('heading', { name: 'Autenticador da conta duda' }),
    ).toBeTruthy();
    expect(within(cartao).getByTestId('segredo-totp').textContent).toBe(
      'JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP',
    );
    expect(
      within(cartao)
        .getByRole('link', { name: 'Abrir no Google Authenticator' })
        .getAttribute('href'),
    ).toBe(otpauth('duda'));
    expect(await within(cartao).findByAltText(/QR code/)).toBeTruthy();
  });

  it('Gerar nova senha para todos, Regenerar 2FA só para admin, nada na própria conta', async () => {
    const fetchMock = montarFetch();
    render(<PaginaUsuarios />);
    const linhaLia = (await screen.findByText(/Lia \(lia\)/)).closest('li') as HTMLElement;
    const linhaBia = screen.getByText(/Bia \(bia\)/).closest('li') as HTMLElement;
    const linhaEu = screen.getByText(/Erico \(erico\)/).closest('li') as HTMLElement;
    expect(within(linhaBia).getByText(/aguardando a pessoa criar a senha/)).toBeTruthy();
    expect(within(linhaLia).getByRole('button', { name: 'Gerar nova senha' })).toBeTruthy();
    expect(within(linhaLia).queryByRole('button', { name: 'Regenerar 2FA' })).toBeNull();
    expect(within(linhaBia).getByRole('button', { name: 'Regenerar 2FA' })).toBeTruthy();
    expect(within(linhaEu).queryByRole('button', { name: 'Gerar nova senha' })).toBeNull();
    expect(within(linhaEu).queryByRole('button', { name: 'Regenerar 2FA' })).toBeNull();

    fireEvent.click(within(linhaLia).getByRole('button', { name: 'Gerar nova senha' }));
    expect(fetchMock.mock.calls.some((item) => String(item[0]).endsWith('/senha/gerar'))).toBe(
      false,
    );
    fireEvent.click(within(linhaLia).getByRole('button', { name: 'Confirmar nova senha' }));
    const novaSenha = await within(linhaLia).findByTestId('senha-provisoria');
    expect(novaSenha.textContent).toBe('Nova-Senh-Aprv-Isor');
    expect(
      fetchMock.mock.calls.some((item) => String(item[0]).endsWith('/v1/usuarios/v1/senha/gerar')),
    ).toBe(true);

    fireEvent.click(within(linhaBia).getByRole('button', { name: 'Regenerar 2FA' }));
    fireEvent.click(within(linhaBia).getByRole('button', { name: 'Confirmar novo 2FA' }));
    await waitFor(() =>
      expect(
        within(linhaBia).getByRole('heading', { name: 'Autenticador da conta bia' }),
      ).toBeTruthy(),
    );
    expect(within(linhaBia).queryByTestId('senha-provisoria')).toBeNull();
  });
});
