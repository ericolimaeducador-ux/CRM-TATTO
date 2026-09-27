import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PainelConta } from './PainelConta';
import { agruparChave } from './InscricaoTotp';

// Chave de exemplo do RFC 4226 (não é segredo de ninguém).
const SEGREDO_TESTE = 'JBSWY3DPEHPK3PXP';
const OTPAUTH_TESTE = `otpauth://totp/TattooArt:erico?secret=${SEGREDO_TESTE}&issuer=TattooArt&digits=6&period=30`;

afterEach(() => {
  cleanup();
  localStorage.clear();
});

it('agrupa a chave em blocos de 4', () => {
  expect(agruparChave('ABCDEFGHIJ')).toBe('ABCD EFGH IJ');
  expect(agruparChave(' ab cd ')).toBe('abcd');
});

describe('painel da conta', () => {
  it('encerra a sessão local quando a rede falha', async () => {
    localStorage.setItem('captura7.token', 'abc');
    localStorage.setItem('captura7.totpPendente', '1');
    const mensagens: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('rede');
      }),
    );
    render(
      <PainelConta
        codigo=""
        pendente={false}
        aoMensagem={(texto) => mensagens.push(texto)}
        aoSair={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));
    await waitFor(() => expect(localStorage.getItem('captura7.token')).toBeNull());
    expect(localStorage.getItem('captura7.totpPendente')).toBeNull();
    expect(mensagens.at(-1)).toContain('neste aparelho');
    expect(mensagens.at(-1)).toContain('Sem rede');
  });

  it('limpa os campos depois de trocar a senha', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ dados: { trocada: true } }) })),
    );
    render(
      <PainelConta
        codigo=""
        pendente={false}
        aoMensagem={() => undefined}
        aoSair={() => undefined}
      />,
    );
    fireEvent.change(screen.getByLabelText('Senha atual'), { target: { value: 'antiga-senha' } });
    fireEvent.change(screen.getByLabelText('Senha nova'), {
      target: { value: 'nova-senha-longa' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Trocar senha' }));
    await waitFor(() =>
      expect((screen.getByLabelText('Senha atual') as HTMLInputElement).value).toBe(''),
    );
    expect((screen.getByLabelText('Senha nova') as HTMLInputElement).value).toBe('');
  });

  it('só tira o aviso de inscrição depois de ativar', async () => {
    localStorage.setItem('captura7.totpPendente', '1');
    const fetchMock = vi.fn(async (entrada: RequestInfo | URL, _init?: RequestInit) => ({
      ok: true,
      json: async () =>
        String(entrada).endsWith('/ativar')
          ? { dados: { ativado: true } }
          : { dados: { segredoBase32: SEGREDO_TESTE, otpauth: OTPAUTH_TESTE, pendente: true } },
    }));
    vi.stubGlobal('fetch', fetchMock);
    render(
      <PainelConta codigo="" pendente aoMensagem={() => undefined} aoSair={() => undefined} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Inscrever autenticador' }));
    await screen.findByRole('heading', { name: 'Cadastre o TattooArt no seu autenticador' });
    expect(localStorage.getItem('captura7.totpPendente')).toBe('1');
    fireEvent.change(screen.getByLabelText('Código de 6 dígitos do autenticador'), {
      target: { value: '123 456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ativar autenticador' }));
    await waitFor(() => expect(localStorage.getItem('captura7.totpPendente')).toBeNull());
    const envio = fetchMock.mock.calls.find((item) => String(item[0]).endsWith('/ativar'));
    expect(JSON.parse(String(envio?.[1]?.body))).toEqual({ codigoTotp: '123456' });
  });

  it('mostra a inscrição em passos logo abaixo do botão, com link, QR e chave agrupada', async () => {
    localStorage.setItem('captura7.totpPendente', '1');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          dados: { segredoBase32: SEGREDO_TESTE, otpauth: OTPAUTH_TESTE, pendente: true },
        }),
      })),
    );
    const { container } = render(
      <PainelConta codigo="" pendente aoMensagem={() => undefined} aoSair={() => undefined} />,
    );
    expect(screen.queryByRole('button', { name: 'Confirmar passo extra' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Trocar senha' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Inscrever autenticador' }));
    const titulo = await screen.findByRole('heading', {
      name: 'Cadastre o TattooArt no seu autenticador',
    });
    const botao = screen.getByRole('button', { name: 'Inscrever autenticador' });
    // O bloco vem logo depois do botão Inscrever, não no fim da página.
    expect(botao.nextElementSibling?.contains(titulo)).toBe(true);
    const link = screen.getByRole('link', { name: 'Abrir no Google Authenticator' });
    expect(link.getAttribute('href')).toBe(OTPAUTH_TESTE);
    const qr = await screen.findByAltText('QR code para cadastrar o TattooArt no autenticador');
    expect(qr.getAttribute('src')).toMatch(/^data:image\/svg\+xml/);
    expect(screen.getByTestId('segredo-totp').textContent).toBe('JBSW Y3DP EHPK 3PXP');
    expect(screen.getByText('Toque em Inserir chave de configuração.')).toBeTruthy();
    expect(screen.getByText(/Baseado em tempo/)).toBeTruthy();
    expect(screen.getByText(/só a última vale/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sair' })).toBeTruthy();
    expect(container.textContent?.toLowerCase()).not.toContain('captura7');
  });

  it('copia a chave sem espaços e cai no execCommand sem clipboard', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          dados: { segredoBase32: SEGREDO_TESTE, otpauth: OTPAUTH_TESTE, pendente: true },
        }),
      })),
    );
    const escrever = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: escrever },
    });
    const { unmount } = render(
      <PainelConta codigo="" pendente aoMensagem={() => undefined} aoSair={() => undefined} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Inscrever autenticador' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Copiar' }));
    expect(await screen.findByRole('button', { name: 'Chave copiada' })).toBeTruthy();
    expect(escrever).toHaveBeenCalledWith(SEGREDO_TESTE);
    unmount();

    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    const execCommand = vi.fn(() => true);
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });
    render(
      <PainelConta codigo="" pendente aoMensagem={() => undefined} aoSair={() => undefined} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Inscrever autenticador' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Copiar' }));
    expect(await screen.findByRole('button', { name: 'Chave copiada' })).toBeTruthy();
    expect(execCommand).toHaveBeenCalledWith('copy');
  });
});
