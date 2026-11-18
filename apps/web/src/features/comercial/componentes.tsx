import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { criarIdLocal } from '@/lib/offline/fila';
import { useNavigate } from 'react-router-dom';
import { temSessao } from './api';

export function Icone({ nome, tamanho = 20 }: { nome: string; tamanho?: number }) {
  const caminhos: Record<string, ReactNode> = {
    painel: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="11" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="18" width="7" height="3" rx="1" />
      </>
    ),
    contas: (
      <>
        <path d="M4 21V5l8-3 8 3v16M2 21h20M9 21v-5h6v5M8 7h1m6 0h1M8 11h1m6 0h1" />
      </>
    ),
    agenda: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 11h18m-13 4h2m4 0h2m-8 3h2" />
      </>
    ),
    funil: (
      <>
        <path d="M3 4h18l-7 8v7l-4 2v-9Z" />
      </>
    ),
    produtos: (
      <>
        <path d="m12 3 9 5-9 5-9-5 9-5Zm-9 5v10l9 4 9-4V8M12 13v9m-4-16 9 5" />
      </>
    ),
    propostas: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Zm0 0v6h6M8 12h8m-8 4h8" />
      </>
    ),
    contatos: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 21v-3a6 6 0 0 1 12 0v3m2-15a3 3 0 0 1 0 6m1 3a5 5 0 0 1 3 5" />
      </>
    ),
    qr: (
      <>
        <path d="M3 8V3h5m8 0h5v5m0 8v5h-5m-8 0H3v-5" />
        <path d="M7 7h3v3H7zm7 0h3v3h-3zM7 14h3v3H7zm7 0h3v3h-3z" />
      </>
    ),
    busca: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    seta: <path d="M5 12h14m-5-5 5 5-5 5" />,
    mais: <path d="M12 5v14M5 12h14" />,
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    fechar: <path d="m6 6 12 12M6 18 18 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    relogio: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    local: (
      <>
        <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    grafico: (
      <>
        <path d="M3 3v18h18M7 15l4-5 4 2 6-7" />
      </>
    ),
    usuario: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 22v-2a8 8 0 0 1 16 0v2" />
      </>
    ),
    sync: (
      <>
        <path d="M20 7a9 9 0 0 0-15-2L2 8m0-5v5h5m-3 9a9 9 0 0 0 15 2l3-3m0 5v-5h-5" />
      </>
    ),
  };
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {caminhos[nome] ?? caminhos.propostas}
    </svg>
  );
}
export function Logo() {
  return (
    <span className="tv-logo">
      <img
        src={`${import.meta.env.BASE_URL}brand/telaviva-lockup.svg`}
        alt="Tela Viva — cuidados para pele tatuada"
      />
    </span>
  );
}
export function CapturaRapida() {
  const navegar = useNavigate();
  return (
    <div className="tv-quick-actions">
      <button
        className="tv-button tv-button-primary"
        onClick={() => navegar(`/contatos/${criarIdLocal()}`)}
      >
        <Icone nome="mais" />
        Digitar
      </button>
      <Link className="tv-button tv-button-light" to="/capturar/qr">
        <Icone nome="qr" />
        Ler QR
      </Link>
    </div>
  );
}
export function CabecalhoPagina({
  titulo,
  descricao,
  acao,
  sobrancelha,
}: {
  titulo: string;
  descricao: string;
  acao?: ReactNode;
  sobrancelha?: string;
}) {
  return (
    <div className="tv-page-heading">
      <div>
        <span className="tv-eyebrow">{sobrancelha ?? 'SEU ESPAÇO COMERCIAL'}</span>
        <h1>{titulo}</h1>
        <p>{descricao}</p>
      </div>
      {acao}
    </div>
  );
}
export function AvisoDados({
  erro,
  carregando,
  atualizar,
}: {
  erro: string;
  carregando: boolean;
  atualizar: () => void;
}) {
  if (!temSessao())
    return (
      <div className="tv-access-card">
        <span className="tv-icon-tile">
          <Icone nome="usuario" tamanho={25} />
        </span>
        <div>
          <h2>Sua carteira começa com uma conexão.</h2>
          <p>
            Entre para acompanhar clientes, visitas e oportunidades. A captura rápida continua
            disponível, mesmo sem internet.
          </p>
          <Link className="tv-button tv-button-primary" to="/entrar">
            Entrar no Tela Viva
            <Icone nome="seta" />
          </Link>
        </div>
      </div>
    );
  if (carregando)
    return (
      <div className="tv-loading" role="status">
        <span className="tv-spinner" /> Carregando sua carteira…
      </div>
    );
  if (erro)
    return (
      <div className="tv-error" role="alert">
        <div>
          <strong>Não foi possível abrir a carteira</strong>
          <p>{erro}</p>
        </div>
        <button className="tv-button tv-button-light" onClick={atualizar}>
          Tentar novamente
        </button>
        <Link to="/entrar">Revisar sessão</Link>
      </div>
    );
  return null;
}
export function Vazio({
  titulo,
  texto,
  acao,
}: {
  titulo: string;
  texto: string;
  acao?: ReactNode;
}) {
  return (
    <div className="tv-empty">
      <span className="tv-empty-symbol">
        <Icone nome="produtos" tamanho={30} />
      </span>
      <h3>{titulo}</h3>
      <p>{texto}</p>
      {acao}
    </div>
  );
}
export function Selo({ valor, children }: { valor?: string; children?: ReactNode }) {
  return <span className={`tv-badge tv-badge-${valor ?? 'neutro'}`}>{children ?? valor}</span>;
}
