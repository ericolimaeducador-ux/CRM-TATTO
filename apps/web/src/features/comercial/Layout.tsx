import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { perfilLogado } from '@/lib/offline/sessao';
import { Menu } from '../captura/Menu';
import { BarraSincronizacao } from '../captura/BarraSincronizacao';
import { Icone, Logo } from './componentes';

const SECOES: Record<string, string> = {
  carteira: 'Minha carteira',
  agenda: 'Agenda de visitas',
  oportunidades: 'Oportunidades',
  produtos: 'Produtos',
  precos: 'Preços por cliente',
  treinamentos: 'Treinamentos',
  relatorios: 'Relatórios comerciais',
  propostas: 'Propostas',
  campanhas: 'Campanhas',
  capturar: 'Captura rápida',
  contatos: 'Contatos',
  entrar: 'Entrar',
  'minha-conta': 'Minha conta',
  usuarios: 'Usuários da equipe',
  fila: 'Fila de sincronização',
  busca: 'Busca de contatos',
};
export function Layout({ children }: { children: ReactNode }) {
  const local = useLocation();
  const navegar = useNavigate();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [perfil, setPerfil] = useState(perfilLogado);
  const [online, setOnline] = useState(navigator.onLine);
  const sidebar = useRef<HTMLElement>(null);
  const botaoMenu = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!window.matchMedia) return;
    const media = window.matchMedia('(max-width: 760px)');
    const atualizar = () => sidebar.current?.toggleAttribute('inert', media.matches && !aberto);
    atualizar();
    media.addEventListener('change', atualizar);
    if (aberto && media.matches) sidebar.current?.querySelector<HTMLElement>('button')?.focus();
    return () => media.removeEventListener('change', atualizar);
  }, [aberto, local.pathname]);
  useEffect(() => {
    const atualizar = () => setPerfil(perfilLogado());
    const rede = () => setOnline(navigator.onLine);
    window.addEventListener('tela-viva-sessao', atualizar);
    window.addEventListener('storage', atualizar);
    window.addEventListener('online', rede);
    window.addEventListener('offline', rede);
    return () => {
      window.removeEventListener('tela-viva-sessao', atualizar);
      window.removeEventListener('storage', atualizar);
      window.removeEventListener('online', rede);
      window.removeEventListener('offline', rede);
    };
  }, []);
  useEffect(() => {
    setAberto(false);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [local.pathname]);
  useEffect(() => {
    const fechar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        setAberto(false);
        botaoMenu.current?.focus();
      }
    };
    window.addEventListener('keydown', fechar);
    return () => window.removeEventListener('keydown', fechar);
  }, []);
  const segmento = local.pathname.split('/')[1] ?? '';
  const comercial = [
    '',
    'carteira',
    'agenda',
    'oportunidades',
    'produtos',
    'propostas',
    'precos',
    'treinamentos',
    'relatorios',
    'campanhas',
  ].includes(segmento);
  if (segmento === 'entrar') return <main className="tv-login-screen">{children}</main>;
  if (segmento === 'p' || segmento === 'termo' || segmento === 'inscricao-treinamento')
    return (
      <div className="tv-public">
        <Link to="/" className="tv-brand-link">
          <Logo />
        </Link>
        <main className="tv-legacy">{children}</main>
      </div>
    );
  const enviarBusca = (evento: FormEvent) => {
    evento.preventDefault();
    navegar(`/carteira?q=${encodeURIComponent(busca)}`);
  };
  return (
    <div className="tv-shell">
      <a href="#conteudo" className="tv-skip">
        Pular para o conteúdo
      </a>
      {aberto ? (
        <button
          className="tv-drawer-overlay"
          aria-label="Fechar navegação"
          onClick={() => setAberto(false)}
        />
      ) : null}
      <aside
        ref={sidebar}
        className={`tv-sidebar ${aberto ? 'is-open' : ''}`}
        id="navegacao-principal"
      >
        <div className="tv-sidebar-brand">
          <Link to="/" aria-label="Tela Viva — início">
            <Logo />
          </Link>
          <button
            className="tv-mobile-close tv-icon-button"
            aria-label="Fechar menu"
            onClick={() => setAberto(false)}
          >
            <Icone nome="fechar" />
          </button>
        </div>
        <Menu aoNavegar={() => setAberto(false)} />
        <div className="tv-sidebar-bottom">
          <span className="tv-mini-logo">
            <img
              src={`${import.meta.env.BASE_URL}brand/telaviva-icone-16px.svg`}
              alt=""
              width="24"
              height="24"
            />
          </span>
          <div>
            <strong>Relacionamentos que cuidam.</strong>
            <small>Estúdios, cuidado e conexões</small>
          </div>
        </div>
      </aside>
      <div className="tv-main-area">
        <header className="tv-topbar">
          <div className="tv-topbar-title">
            <button
              ref={botaoMenu}
              className="tv-mobile-menu tv-icon-button"
              aria-expanded={aberto}
              aria-controls="navegacao-principal"
              aria-label="Abrir menu"
              onClick={() => setAberto(!aberto)}
            >
              <Icone nome="menu" />
            </button>
            <span className="tv-breadcrumb">
              Seu espaço<span>/</span>
              <strong>{SECOES[segmento] ?? 'Visão geral'}</strong>
            </span>
          </div>
          <form className="tv-global-search" onSubmit={enviarBusca}>
            <Icone nome="busca" tamanho={18} />
            <input
              aria-label="Buscar na carteira"
              placeholder="Buscar na carteira…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <kbd>↵</kbd>
          </form>
          <div className="tv-topbar-profile">
            <span
              className={`tv-network-dot ${online ? '' : 'is-offline'}`}
              title={online ? 'Navegador com rede' : 'Navegador sem rede'}
            />
            <span className="tv-profile-text">
              <strong>{perfil?.nome ?? 'Bem-vindo'}</strong>
              <small>
                {perfil
                  ? ({
                      admin: 'Administrador',
                      gestor: 'Gestão comercial',
                      vendedor: 'Representante',
                      auditor: 'Auditoria',
                    }[perfil.papel] ?? perfil.papel)
                  : 'Seu espaço de conexões'}
              </small>
            </span>
            <Link
              className="tv-avatar"
              to={perfil ? '/minha-conta' : '/entrar'}
              aria-label="Abrir minha conta"
            >
              {(perfil?.nome ?? 'TV')
                .split(' ')
                .slice(0, 2)
                .map((n) => n[0])
                .join('')}
            </Link>
          </div>
        </header>
        <main id="conteudo" className={`tv-content ${comercial ? '' : 'tv-content-legacy'}`}>
          <div className="tv-sync-status">
            <BarraSincronizacao />
            {!online ? (
              <p>
                Você está sem rede. A captura continua disponível neste aparelho; a carteira
                comercial precisa de conexão.
              </p>
            ) : null}
          </div>
          {children}
        </main>
        <footer className="tv-footer">
          <span>
            Tela Viva <span>·</span> Cuidados para pele tatuada.
          </span>
          <span>Captura simples. Próximos passos claros.</span>
        </footer>
      </div>
    </div>
  );
}
