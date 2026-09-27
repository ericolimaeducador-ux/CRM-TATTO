import { render, screen } from '@testing-library/react';
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
    const nomes = screen.getAllByRole('link').map((item) => item.textContent);
    expect(nomes[0]).toBe('Cadastros');
    expect(screen.getByRole('link', { name: 'Duplicatas' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Busca' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Usuários' })).toBeNull();
  });
});
