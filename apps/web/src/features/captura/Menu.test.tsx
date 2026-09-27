import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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
