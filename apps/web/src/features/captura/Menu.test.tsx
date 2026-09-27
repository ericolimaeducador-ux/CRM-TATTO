import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { Menu } from './Menu';

describe('menu por perfil', () => {
  it('esconde Duplicatas sem sessão e mostra para gestor', () => {
    localStorage.clear();
    const { unmount } = render(
      <MemoryRouter>
        <Menu />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('link', { name: 'Duplicatas' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Usuários' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Cadastros' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Entrar' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Fila' })).toBeTruthy();
    unmount();
    localStorage.setItem(
      'captura7.perfil',
      JSON.stringify({ id: '1', papel: 'gestor', nome: 'Gestor' }),
    );
    render(
      <MemoryRouter>
        <Menu />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('link', { name: 'Entrar' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Novo' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Cadastros' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Fila' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Mais' }));
    expect(screen.getByRole('button', { name: 'Gestor' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Sair' })).toBeNull();
    expect(screen.getByText('Administração')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Duplicatas' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Busca' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Importar/Exportar' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Usuários' })).toBeNull();
  });
});

describe('painel Mais fecha sozinho', () => {
  function ondeEstou() {
    return <p data-testid="rota">{useLocation().pathname}</p>;
  }

  function montar() {
    localStorage.clear();
    localStorage.setItem(
      'captura7.perfil',
      JSON.stringify({ id: '1', papel: 'admin', nome: 'Admin' }),
    );
    const OndeEstou = ondeEstou;
    return render(
      <MemoryRouter initialEntries={['/capturar']}>
        <Menu />
        <OndeEstou />
      </MemoryRouter>,
    );
  }

  const botaoMais = () => screen.getByRole('button', { name: 'Mais' });
  const painel = () => document.getElementById('painel-mais');
  const fundo = () => document.querySelector('.fundo-sobreposicao');

  function abrir() {
    fireEvent.click(botaoMais());
    expect(botaoMais().getAttribute('aria-expanded')).toBe('true');
    expect(painel()?.classList.contains('aberto')).toBe(true);
    expect(fundo()).not.toBeNull();
  }

  function esperarFechado() {
    expect(botaoMais().getAttribute('aria-expanded')).toBe('false');
    expect(painel()?.classList.contains('aberto')).toBe(false);
    expect(fundo()).toBeNull();
  }

  afterEach(() => cleanup());

  it('fecha ao escolher um item e vai para a página', () => {
    montar();
    abrir();
    fireEvent.click(screen.getByRole('link', { name: 'Duplicatas' }));
    expect(screen.getByTestId('rota').textContent).toBe('/duplicatas');
    esperarFechado();
    abrir();
    fireEvent.click(screen.getByRole('link', { name: 'Usuários' }));
    expect(screen.getByTestId('rota').textContent).toBe('/usuarios');
    esperarFechado();
  });

  it('fecha ao tocar fora do painel', () => {
    montar();
    abrir();
    fireEvent.click(fundo() as Element);
    esperarFechado();
    expect(screen.getByTestId('rota').textContent).toBe('/capturar');
  });

  it('fecha no Escape, no Voltar e ao tocar em Mais de novo', async () => {
    montar();
    abrir();
    fireEvent.keyDown(window, { key: 'Escape' });
    esperarFechado();
    abrir();
    // O Voltar do Android consome a entrada que o painel empilhou.
    act(() => {
      window.history.back();
    });
    await waitFor(esperarFechado);
    expect(screen.getByTestId('rota').textContent).toBe('/capturar');
    abrir();
    fireEvent.click(botaoMais());
    esperarFechado();
  });

  it('fecha também o painel da conta quando o Mais fecha', () => {
    montar();
    abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Admin' }));
    expect(screen.getByRole('button', { name: 'Sair' })).toBeTruthy();
    fireEvent.click(fundo() as Element);
    esperarFechado();
    abrir();
    expect(screen.queryByRole('button', { name: 'Sair' })).toBeNull();
  });
});
