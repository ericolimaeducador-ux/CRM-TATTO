import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TelaTermo } from './TelaTermo';

const CURTO = `**Seus dados no TattooArt**

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
    expect(destaque.textContent).not.toContain('CONTROLADOR_EMAIL');
    expect(screen.getByText(/sistema externo/i).textContent).not.toContain('ERP_WEBHOOK_URL');
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
    expect(screen.queryByLabelText('Token do captcha')).toBeNull();
    const area = document.createElement('textarea');
    area.name = 'cf-turnstile-response';
    area.value = 'token-do-widget';
    document.body.appendChild(area);
    fireEvent.click(screen.getByRole('checkbox', { name: /contato comercial/i }));
    await waitFor(() => {
      expect(
        (screen.getByRole('button', { name: 'Concluir cadastro' }) as HTMLButtonElement).disabled,
      ).toBe(false);
    });
  });

  it('pede outro desafio depois de uma recusa e mantém os dados digitados', async () => {
    let desafios = 0;
    const envios: Record<string, unknown>[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (String(url).includes('captcha')) {
          desafios += 1;
          return {
            ok: true,
            status: 200,
            json: async () => ({
              dados: {
                provedor: 'local',
                id: `id-${desafios}`,
                pergunta: `Quanto é ${desafios} + 1?`,
              },
            }),
          };
        }
        if (String(url).includes('autocadastro')) {
          envios.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
          return {
            ok: false,
            status: 422,
            json: async () => ({
              erros: [{ codigo: 'CAPTCHA_INVALIDO', mensagem: 'O desafio não confere.' }],
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ dados: { versao: 'v', textoCurto: 'Curto', textoCompleto: 'C' } }),
        };
      }),
    );
    render(<TelaTermo modo="autocadastro" token="abc" />);
    expect((await screen.findByTestId('pergunta-captcha')).textContent).toContain('1 + 1');
    const nome = screen.getByLabelText('Nome') as HTMLInputElement;
    fireEvent.change(nome, { target: { value: 'Ana Tattoo' } });
    const resposta = screen.getByLabelText(/Resposta do desafio/) as HTMLInputElement;
    expect(resposta.getAttribute('autocomplete')).toBe('off');
    expect(resposta.getAttribute('inputmode')).toBe('numeric');
    fireEvent.change(resposta, { target: { value: '2' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /contato comercial/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Concluir cadastro' }));
    expect(await screen.findByText(/Responda o novo desafio/)).toBeTruthy();
    expect(screen.getByTestId('pergunta-captcha').textContent).toContain('2 + 1');
    expect((screen.getByLabelText(/Resposta do desafio/) as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Nome') as HTMLInputElement).value).toBe('Ana Tattoo');
    expect(envios).toHaveLength(1);
    expect(envios[0]?.captchaId).toBe('id-1');
    fireEvent.change(screen.getByLabelText(/Resposta do desafio/), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Concluir cadastro' }));
    await waitFor(() => expect(envios).toHaveLength(2));
    expect(envios[1]?.captchaId).toBe('id-2');
    expect(envios[1]?.nome).toBe('Ana Tattoo');
  });
});
