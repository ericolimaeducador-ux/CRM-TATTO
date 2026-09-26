import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TelaTermo } from './TelaTermo';

const CURTO = `**Seus dados no captura7**

> **Importante: este cadastro existe para que a 7Safe possa entrar em contato com você para apresentar produtos e serviços. Por isso, sem a autorização de contato comercial abaixo não é possível concluir o cadastro.** Você pode revogar essa autorização depois, a qualquer momento e de graça.

☐ **Contato comercial (necessário para concluir o cadastro).** Autorizo a 7Safe a entrar em contato comigo por **[e-mail / telefone / WhatsApp — A PREENCHER, DECISÃO D5]** para apresentar produtos e serviços.`;

describe('tela do termo', () => {
  it('mostra o destaque sem caixa marcada e só então habilita concluir', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          dados: {
            versao: '[A PREENCHER, D1]',
            textoCurto: CURTO,
            textoCompleto: 'Art. 18, VI',
          },
        }),
      })),
    );
    render(<TelaTermo modo="autocadastro" token="abc" />);
    const destaque = await screen.findByTestId('destaque-consentimento');
    expect(destaque.textContent).toContain('sem a autorização de contato comercial');
    expect(screen.getAllByText(/DECISÃO D5/).length).toBeGreaterThan(0);
    const botao = screen.getByRole('button', { name: 'Concluir cadastro' });
    expect((botao as HTMLButtonElement).disabled).toBe(true);
    const caixa = screen.getByRole('checkbox', { name: /Contato comercial/ });
    expect((caixa as HTMLInputElement).checked).toBe(false);
    fireEvent.click(caixa);
    expect((botao as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByText(/sincronizado/i)).toBeNull();
    expect(document.body.textContent).not.toContain('**');
    expect(document.body.textContent).not.toContain('☐');
  });

  it('mostra a caixa de ERP desligada e o fallback sem a 7Safe', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('rede');
      }),
    );
    render(
      <MemoryRouter>
        <TelaTermo modo="vendedor" />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/Não consegui carregar o termo/)).toBeTruthy();
    const destaque = screen.getByTestId('destaque-consentimento');
    expect(destaque.textContent).toContain('pessoa física');
    expect(destaque.textContent).not.toContain('7Safe');
    const erp = screen.getByRole('checkbox', { name: /sistema externo/i });
    expect((erp as HTMLInputElement).checked).toBe(false);
  });

  it('mostra Turnstile quando o servidor envia a chave pública', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => ({
        ok: true,
        json: async () =>
          String(url).includes('captcha')
            ? { dados: { provedor: 'turnstile', sitekey: 'chave-publica' } }
            : { dados: { versao: 'v', textoCurto: 'Curto', textoCompleto: 'Completo' } },
      })),
    );
    render(<TelaTermo modo="autocadastro" token="abc" />);
    expect(await screen.findByTestId('widget-captcha')).toBeTruthy();
    expect(screen.getByLabelText('Token do captcha')).toBeTruthy();
  });
});
