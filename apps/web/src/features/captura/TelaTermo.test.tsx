import { fireEvent, render, screen } from '@testing-library/react';
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
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByRole('checkbox'));
    expect((botao as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByText(/sincronizado/i)).toBeNull();
  });
});
