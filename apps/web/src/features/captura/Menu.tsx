import { NavLink } from 'react-router-dom';
import { perfilLogado, podeGerir } from '@/lib/offline/sessao';
import { Icone } from '../comercial/componentes';

type Item = [destino: string, texto: string, icone: string];

/**
 * Menu agrupado pelo que a pessoa faz no dia (ADR-026): primeiro o que se usa todo
 * dia (contatos, campanhas, captura), depois vendas, equipe e administração.
 * A busca fica só no topo; "Meu QR" fica dentro de Capturar.
 */
export function Menu({ aoNavegar }: { aoNavegar?: () => void }) {
  const perfil = perfilLogado();
  const gestao = podeGerir();
  const diaADia: Item[] = [
    ['/', 'Início', 'painel'],
    ['/contatos', 'Contatos', 'contatos'],
    ...(gestao || perfil?.papel === 'vendedor'
      ? ([['/campanhas', 'Campanhas WhatsApp', 'propostas']] as Item[])
      : []),
    ['/capturar', 'Capturar contato', 'qr'],
  ];
  const vendas: Item[] = [
    ['/carteira', 'Contas e estúdios', 'contas'],
    ['/agenda', 'Agenda de visitas', 'agenda'],
    ['/oportunidades', 'Oportunidades', 'funil'],
    ['/propostas', 'Propostas', 'propostas'],
    ['/precos', 'Preços por cliente', 'grafico'],
    ['/produtos', 'Produtos', 'produtos'],
  ];
  const equipe: Item[] = [
    ['/treinamentos', 'Treinamentos', 'agenda'],
    ['/relatorios', 'Relatórios', 'grafico'],
  ];
  const administracao: Item[] = [
    ...(perfil?.papel === 'admin' ? ([['/usuarios', 'Usuários', 'usuario']] as Item[]) : []),
    ...(gestao ? ([['/duplicatas', 'Duplicatas', 'contatos']] as Item[]) : []),
    ['/fila', 'Envios pendentes', 'sync'],
  ];
  const grupo = (titulo: string, itens: Item[], secundario = false) =>
    itens.length ? (
      <div className="tv-nav-group" key={titulo}>
        <span className={`tv-nav-caption ${secundario ? 'tv-nav-caption-secondary' : ''}`}>
          {titulo}
        </span>
        {itens.map(([to, texto, icone]) => (
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
      </div>
    ) : null;
  return (
    <nav className="tv-navigation" aria-label="Seções">
      {grupo('DIA A DIA', diaADia)}
      {grupo('VENDAS', vendas, true)}
      {grupo('EQUIPE', equipe, true)}
      {grupo('ADMINISTRAÇÃO', administracao, true)}
      <NavLink
        className={({ isActive }) => `tv-nav-link ${isActive ? 'is-active' : ''}`}
        to={perfil ? '/minha-conta' : '/entrar'}
        onClick={aoNavegar}
      >
        <Icone nome="usuario" />
        {perfil ? 'Minha conta' : 'Entrar'}
      </NavLink>
    </nav>
  );
}
