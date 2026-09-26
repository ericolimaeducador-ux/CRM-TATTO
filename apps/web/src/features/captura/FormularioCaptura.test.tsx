import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { FormularioCaptura } from './FormularioCaptura';

const fila = vi.hoisted(() => ({
  lerUm: vi.fn(async () => undefined as unknown),
  garantirContato: vi.fn(),
  salvarCampo: vi.fn(),
  apagarRascunhoLocal: vi.fn(async () => true),
}));

vi.mock('@/lib/offline/fila', () => ({
  lerUm: fila.lerUm,
  observarFila: () => () => undefined,
  salvarCampo: fila.salvarCampo,
  apagarRascunhoLocal: fila.apagarRascunhoLocal,
  garantirContato: fila.garantirContato,
}));

describe('formulário de captura', () => {
  it('não cria contato em branco e separa PF de PJ', async () => {
    fila.lerUm.mockResolvedValue(undefined);
    fila.garantirContato.mockClear();
    render(
      <MemoryRouter initialEntries={['/contatos/local-1']}>
        <Routes>
          <Route path="/contatos/:idLocal" element={<FormularioCaptura />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByLabelText('Nome')).toBeTruthy();
    expect(fila.garantirContato).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('CPF')).toBeNull();
    expect(screen.queryByLabelText('CNPJ')).toBeNull();
    fireEvent.click(screen.getByLabelText('Pessoa física'));
    expect(screen.getByLabelText('CPF')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Pessoa jurídica'));
    expect(screen.queryByLabelText('CPF')).toBeNull();
    expect(screen.getByLabelText('CNPJ')).toBeTruthy();
    expect(screen.getByLabelText('Razão social')).toBeTruthy();
  });

  it('mostra aviso e mensagem gravados pelo servidor', async () => {
    fila.lerUm.mockResolvedValue({
      idLocal: 'local-1',
      campos: { nome: 'Ana', tipoPessoa: 'PF' },
      modo: 'manual',
      estado: 'local',
      tentativas: 0,
      atualizadoEm: 1,
      avisos: [{ campo: 'email', codigo: 'EMAIL_INVALIDO', mensagem: 'E-mail inválido.' }],
      mensagem: 'Já existe um contato fora de rascunho com este CPF. A edição não foi gravada.',
    });
    render(
      <MemoryRouter initialEntries={['/contatos/local-1']}>
        <Routes>
          <Route path="/contatos/:idLocal" element={<FormularioCaptura />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText('E-mail inválido.')).toBeTruthy();
    expect(screen.getByText(/A edição não foi gravada/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Excluir rascunho deste aparelho' })).toBeTruthy();
  });
});
