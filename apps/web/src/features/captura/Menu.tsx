import { NavLink } from 'react-router-dom';
import { perfilLogado, podeGerir } from '@/lib/offline/sessao';
import { Icone } from '../comercial/componentes';

export function Menu({ aoNavegar }: { aoNavegar?: () => void }) {
  const perfil = perfilLogado();
  const principais = [
    ['/', 'Visão geral', 'painel'],
    ['/carteira', 'Minha carteira', 'contas'],
    ['/agenda', 'Agenda de visitas', 'agenda'],
    ['/oportunidades', 'Oportunidades', 'funil'],
    ['/produtos', 'Produtos', 'produtos'],
    ['/precos', 'Preços por cliente', 'grafico'],
    ['/treinamentos', 'Treinamentos', 'agenda'],
    ['/relatorios', 'Relatórios', 'grafico'],
    ['/propostas', 'Propostas', 'propostas'],
  ];
  return (
    <nav className="tv-navigation" aria-label="Seções">
      <span className="tv-nav-caption">RELACIONAMENTO</span>
      {principais.map(([to, texto, icone]) => (
        <NavLink
          key={to}
          end={to === '/'}
          to={to}
          onClick={aoNavegar}
          className={({ isActive }) => `tv-nav-link ${isActive ? 'is-active' : ''}`}
        >
          <Icone nome={icone} />
          {texto}
        </NavLink>
      ))}
      <span className="tv-nav-caption tv-nav-caption-secondary">CAPTURA & ORGANIZAÇÃO</span>
      <NavLink className="tv-nav-link" to="/capturar" onClick={aoNavegar}>
        <Icone nome="qr" />
        Captura rápida
      </NavLink>
      <NavLink className="tv-nav-link" to="/contatos" onClick={aoNavegar}>
        <Icone nome="contatos" />
        Contatos
      </NavLink>
      <NavLink className="tv-nav-link" to="/fila" onClick={aoNavegar}>
        <Icone nome="sync" />
        Fila
      </NavLink>
      <NavLink className="tv-nav-link" to="/meu-qr" onClick={aoNavegar}>
        <Icone nome="qr" />
        Meu QR
      </NavLink>
      {perfil ? (
        <NavLink className="tv-nav-link" to="/busca" onClick={aoNavegar}>
          <Icone nome="busca" />
          Busca
        </NavLink>
      ) : null}
      {podeGerir() ? (
        <NavLink className="tv-nav-link" to="/duplicatas" onClick={aoNavegar}>
          <Icone nome="contatos" />
          Duplicatas
        </NavLink>
      ) : null}
      {perfil?.papel === 'admin' ? (
        <NavLink className="tv-nav-link" to="/usuarios" onClick={aoNavegar}>
          <Icone nome="usuario" />
          Usuários
        </NavLink>
      ) : null}
      <NavLink className="tv-nav-link" to="/entrar" onClick={aoNavegar}>
        <Icone nome="usuario" />
        {perfil ? 'Minha conta' : 'Entrar'}
      </NavLink>
    </nav>
  );
}
