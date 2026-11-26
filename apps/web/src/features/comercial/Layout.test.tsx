import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter } from 'react-router-dom';
import { Layout } from './Layout';

vi.mock('../captura/BarraSincronizacao', () => ({ BarraSincronizacao: () => null }));
vi.mock('../captura/Menu', () => ({ Menu: () => null }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('reinicia rolagem ao trocar seção e preserva posição ao mudar só a query', () => {
  const rolar = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  render(
    <MemoryRouter initialEntries={['/contatos']}>
      <Layout>
        <Link to="/contatos?pagina=2">Mesma seção</Link>
        <Link to="/agenda">Outra seção</Link>
      </Layout>
    </MemoryRouter>,
  );
  rolar.mockClear();
  fireEvent.click(screen.getByRole('link', { name: 'Mesma seção' }));
  expect(rolar).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('link', { name: 'Outra seção' }));
  expect(rolar).toHaveBeenCalledOnce();
  expect(rolar).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' });
});

it.each(['/atualizar-cadastro/abc', '/p/abc', '/inscricao-treinamento/abc', '/termo'])(
  'página pública %s abre sem menu, busca nem atalho para o CRM',
  (caminho) => {
    const { container } = render(
      <MemoryRouter initialEntries={[caminho]}>
        <Layout>
          <p>Formulário</p>
        </Layout>
      </MemoryRouter>,
    );
    expect(screen.getByText('Formulário')).toBeTruthy();
    expect(container.querySelector('.tv-public')).toBeTruthy();
    expect(container.querySelector('.tv-sidebar')).toBeNull();
    expect(screen.queryByRole('search')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  },
);
