import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PainelConta } from './PainelConta';

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
        aoSegredo={() => undefined}
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
        aoSegredo={() => undefined}
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
    vi.stubGlobal(
      'fetch',
      vi.fn(async (entrada: RequestInfo | URL) => ({
        ok: true,
        json: async () =>
          String(entrada).endsWith('/ativar')
            ? { dados: { ativado: true } }
            : { dados: { segredoBase32: 'SEGRED', pendente: true } },
      })),
    );
    render(
      <PainelConta
        codigo="123456"
        pendente
        aoMensagem={() => undefined}
        aoSegredo={() => undefined}
        aoSair={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Inscrever autenticador' }));
    await waitFor(() => expect(localStorage.getItem('captura7.totpPendente')).toBe('1'));
    fireEvent.click(screen.getByRole('button', { name: 'Ativar autenticador' }));
    await waitFor(() => expect(localStorage.getItem('captura7.totpPendente')).toBeNull());
  });
});
