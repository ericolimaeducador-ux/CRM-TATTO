import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EditorRegistro } from './EditorRegistro';

const base = {
  _id: '507f1f77bcf86cd799439010',
  secao: 'propostas' as const,
  donoId: 'u',
  versao: 2,
  criadoEm: '2026-11-16T12:00:00Z',
  alteradoEm: '2026-11-16T12:00:00Z',
  arquivado: false,
};
function resposta(corpo: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => corpo } as Response;
}

describe('propostas comerciais Tela Viva', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('seleciona o catálogo e envia itens em centavos para confirmação do servidor', async () => {
    const salvo = vi.fn();
    const fetchMock = vi.fn(async (url: string, opcoes?: RequestInit) => {
      if (opcoes?.method === 'POST')
        return resposta(
          { registro: { ...base, titulo: 'Kit para o estúdio', totalCentavos: 2967 } },
          201,
        );
      if (String(url).includes('/produtos'))
        return resposta({
          registros: [
            { _id: '507f1f77bcf86cd799439011', nome: 'Produto do catálogo', precoCentavos: 1099 },
          ],
          total: 1,
        });
      return resposta({ registros: [], total: 0 });
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<EditorRegistro secao="propostas" aoFechar={vi.fn()} aoSalvar={salvo} />);
    fireEvent.change(screen.getByLabelText('Título da proposta'), {
      target: { value: 'Kit para o estúdio' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar item' }));
    await screen.findByRole('option', { name: 'Produto do catálogo' });
    fireEvent.change(screen.getByLabelText('Produto do catálogo'), {
      target: { value: '507f1f77bcf86cd799439011' },
    });
    expect((screen.getByLabelText('Preço unitário (R$)') as HTMLInputElement).value).toBe('10.99');
    fireEvent.change(screen.getByLabelText('Quantidade'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Desconto (%)'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar na carteira' }));
    await waitFor(() => expect(salvo).toHaveBeenCalledTimes(1));
    const chamada = fetchMock.mock.calls.find(([, opcoes]) => opcoes?.method === 'POST');
    const corpo = JSON.parse(String(chamada?.[1]?.body));
    expect(corpo.itens).toEqual([
      {
        produtoId: '507f1f77bcf86cd799439011',
        descricao: 'Produto do catálogo',
        quantidade: 3,
        precoUnitarioCentavos: 1099,
        descontoPercentual: 10,
      },
    ]);
    expect(corpo.totalCentavos).toBeUndefined();
    expect(salvo.mock.calls[0][0].totalCentavos).toBe(2967);
  });
  it('preserva a edição e impede sobrescrever uma versão concorrente', async () => {
    const fechar = vi.fn();
    const salvo = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, opcoes?: RequestInit) =>
        opcoes?.method === 'PATCH'
          ? resposta({ erros: [{ mensagem: 'Este registro mudou. Atualize a tela.' }] }, 409)
          : resposta({ registros: [], total: 0 }),
      ),
    );
    render(
      <EditorRegistro
        secao="propostas"
        registro={{ ...base, titulo: 'Proposta original', status: 'rascunho', itens: [] }}
        aoFechar={fechar}
        aoSalvar={salvo}
      />,
    );
    fireEvent.change(screen.getByLabelText('Título da proposta'), {
      target: { value: 'Minha alteração preservada' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar na carteira' }));
    await screen.findByRole('alert');
    expect((screen.getByLabelText('Título da proposta') as HTMLInputElement).value).toBe(
      'Minha alteração preservada',
    );
    expect(
      (screen.getByRole('button', { name: 'Salvar na carteira' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(fechar).not.toHaveBeenCalled();
    expect(salvo).not.toHaveBeenCalled();
  });
});
