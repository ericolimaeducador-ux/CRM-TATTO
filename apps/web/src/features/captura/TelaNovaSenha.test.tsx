import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Casca } from '../marca/Casca';

function montar(caminho = '/capturar') {
  return render(
    <MemoryRouter initialEntries={[caminho]}>
      <Casca>
        <Routes>
          <Route path="/capturar" element={<p>tela de captura</p>} />
          <Route path="/cadastros" element={<p>tela de cadastros</p>} />
          <Route path="/entrar" element={<p>tela de entrar</p>} />
        </Routes>
      </Casca>
    </MemoryRouter>,
  );
}

function preencher(atual: string, nova: string, confirmacao = nova) {
  fireEvent.change(screen.getByLabelText('Senha provisória'), { target: { value: atual } });
  fireEvent.change(screen.getByLabelText('Senha nova'), { target: { value: nova } });
  fireEvent.change(screen.getByLabelText('Confirme a senha nova'), {
    target: { value: confirmacao },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar senha nova' }));
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('captura7.token', 'tok');
  localStorage.setItem(
    'captura7.perfil',
    JSON.stringify({ id: 'g', papel: 'gestor', nome: 'Guto' }),
  );
  localStorage.setItem('captura7.trocarSenha', '1');
});

afterEach(() => cleanup());

describe('troca obrigatória da senha provisória', () => {
  it('mostra só a tela de nova senha, em qualquer rota', () => {
    montar('/cadastros');
    expect(screen.getByRole('heading', { name: 'Crie sua nova senha' })).toBeTruthy();
    expect(screen.queryByText('tela de cadastros')).toBeNull();
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('confere tamanho, confirmação e diferença antes de enviar', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    montar();
    preencher('Abcd-Efgh-Jkmn-Pqrs', 'curta');
    expect(screen.getByRole('status').textContent).toContain('12 caracteres');
    preencher('Abcd-Efgh-Jkmn-Pqrs', 'senha-nova-longa', 'outra-coisa-longa');
    expect(screen.getByRole('status').textContent).toContain('confirmação');
    preencher('Abcd-Efgh-Jkmn-Pqrs', 'Abcd-Efgh-Jkmn-Pqrs');
    expect(screen.getByRole('status').textContent).toContain('diferente');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('troca a senha, tira a trava e segue para o app', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ dados: { trocada: true } }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    montar();
    preencher('Abcd-Efgh-Jkmn-Pqrs', 'senha-nova-longa');
    expect(await screen.findByText('tela de cadastros')).toBeTruthy();
    expect(localStorage.getItem('captura7.trocarSenha')).toBeNull();
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const corpo = JSON.parse(String(init.body));
    expect(corpo).toEqual({ senhaAtual: 'Abcd-Efgh-Jkmn-Pqrs', senhaNova: 'senha-nova-longa' });
  });

  it('mostra o erro da API e continua travado', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        json: async () => ({
          erros: [{ mensagem: 'A senha atual não confere. A senha não mudou.' }],
        }),
      })),
    );
    montar();
    preencher('errada-errada', 'senha-nova-longa');
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('não confere'));
    expect(localStorage.getItem('captura7.trocarSenha')).toBe('1');
  });

  it('Sair limpa a sessão e volta para Entrar', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));
    expect(localStorage.getItem('captura7.token')).toBeNull();
    expect(localStorage.getItem('captura7.trocarSenha')).toBeNull();
  });
});
