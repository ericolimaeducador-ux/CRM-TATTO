import { Link, useLocation } from 'react-router-dom';
import { perfilLogado, podeGerir } from '@/lib/offline/sessao';

export function Menu() {
  const local = useLocation();
  const perfil = perfilLogado();
  const gerir = podeGerir();
  const admin = perfil?.papel === 'admin';
  void local.pathname;

  return (
    <nav className="mb-4 flex flex-wrap gap-x-4 gap-y-1" aria-label="Seções">
      <Atalho to="/capturar">Início</Atalho>
      <Atalho to="/contatos">Contatos</Atalho>
      <Atalho to="/fila">Fila</Atalho>
      <Atalho to="/meu-qr">Meu QR</Atalho>
      <Atalho to="/entrar">Entrar</Atalho>
      {perfil ? <Atalho to="/busca">Busca</Atalho> : null}
      {gerir ? <Atalho to="/duplicatas">Duplicatas</Atalho> : null}
      {admin ? <Atalho to="/usuarios">Usuários</Atalho> : null}
    </nav>
  );
}

function Atalho({ to, children }: { to: string; children: string }) {
  return (
    <Link className="inline-flex min-h-12 items-center text-base underline" to={to}>
      {children}
    </Link>
  );
}
