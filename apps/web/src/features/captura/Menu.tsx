import { Link, useLocation } from 'react-router-dom';
import { Marca } from '../marca/Marca';
import { perfilLogado, podeGerir } from '@/lib/offline/sessao';

interface AtalhoItem {
  to: string;
  nome: string;
}

export function Menu() {
  const local = useLocation();
  const perfil = perfilLogado();
  const gerir = podeGerir();
  const admin = perfil?.papel === 'admin';
  const veCadastros = Boolean(perfil);
  const itens: AtalhoItem[] = [
    { to: '/capturar', nome: 'Início' },
    { to: '/contatos', nome: 'Contatos' },
    { to: '/fila', nome: 'Fila' },
    { to: '/meu-qr', nome: 'Meu QR' },
    { to: '/entrar', nome: 'Entrar' },
  ];
  if (veCadastros) itens.unshift({ to: '/cadastros', nome: 'Cadastros' });
  if (perfil) itens.push({ to: '/busca', nome: 'Busca' });
  if (gerir) itens.push({ to: '/duplicatas', nome: 'Duplicatas' });
  if (admin) itens.push({ to: '/usuarios', nome: 'Usuários' });

  return (
    <nav className="nav-app" aria-label="Seções">
      <div className="mb-6 hidden lg:block">
        <Marca />
      </div>
      {itens.map((item) => {
        const ativo =
          local.pathname === item.to ||
          local.pathname.startsWith(`${item.to}/`) ||
          (item.to === '/capturar' && local.pathname === '/');
        return (
          <Link key={item.to} to={item.to} aria-current={ativo ? 'page' : undefined}>
            {item.nome}
          </Link>
        );
      })}
    </nav>
  );
}
