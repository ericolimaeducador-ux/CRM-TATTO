import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  FileSpreadsheet,
  GitMerge,
  Home,
  List,
  MoreHorizontal,
  NotebookTabs,
  Plus,
  QrCode,
  Search,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { criarIdLocal } from '@/lib/offline/fila';
import { perfilLogado, podeGerir, podeImportar } from '@/lib/offline/sessao';
import { useSobreposicao } from '@/lib/sobreposicao';
import { Marca } from '../marca/Marca';
import { MenuConta } from './MenuConta';

interface AtalhoItem {
  to: string;
  nome: string;
  icone: LucideIcon;
}

export function Menu() {
  const local = useLocation();
  const perfil = perfilLogado();
  const mais = useSobreposicao();
  const principais: AtalhoItem[] = [
    { to: '/capturar', nome: 'Início', icone: Home },
    perfil
      ? { to: '/cadastros', nome: 'Cadastros', icone: NotebookTabs }
      : { to: '/contatos', nome: 'Contatos', icone: NotebookTabs },
  ];
  const fila: AtalhoItem = { to: '/fila', nome: 'Fila', icone: List };
  const extras: AtalhoItem[] = [
    ...(perfil ? [{ to: '/contatos', nome: 'Contatos', icone: NotebookTabs }] : []),
    { to: '/meu-qr', nome: 'Meu QR', icone: QrCode },
    ...(perfil ? [{ to: '/busca', nome: 'Busca', icone: Search }] : []),
  ];
  const admin: AtalhoItem[] = [
    ...(podeGerir() ? [{ to: '/duplicatas', nome: 'Duplicatas', icone: GitMerge }] : []),
    ...(podeImportar()
      ? [{ to: '/planilha', nome: 'Importar/Exportar', icone: FileSpreadsheet }]
      : []),
    ...(perfil?.papel === 'admin' ? [{ to: '/usuarios', nome: 'Usuários', icone: Users }] : []),
  ];

  const substituir = mais.substituir;

  return (
    <>
      {mais.aberto ? (
        <div className="fundo-sobreposicao" aria-hidden="true" onClick={mais.fechar} />
      ) : null}
      <nav className="nav-app" aria-label="Seções">
        <div className="mb-6 hidden px-1 lg:block">
          <Marca />
        </div>
        <div className="barra">
          {principais.map((item) => (
            <Atalho key={item.to} item={item} caminho={local.pathname} substituir={substituir} />
          ))}
          <BotaoNovo substituir={substituir} />
          <Atalho item={fila} caminho={local.pathname} substituir={substituir} />
          <button
            type="button"
            className="item-nav botao-mais"
            aria-expanded={mais.aberto}
            aria-controls="painel-mais"
            onClick={mais.alternar}
          >
            <MoreHorizontal aria-hidden="true" />
            <span className="rotulo-curto">Mais</span>
          </button>
        </div>
        <div id="painel-mais" className={mais.aberto ? 'painel-mais aberto' : 'painel-mais'}>
          <MenuConta painelAberto={mais.aberto} />
          {extras.map((item) => (
            <Atalho key={item.to} item={item} caminho={local.pathname} substituir={substituir} />
          ))}
          {admin.length > 0 ? (
            <>
              <p className="secao-nav">Administração</p>
              {admin.map((item) => (
                <Atalho
                  key={item.to}
                  item={item}
                  caminho={local.pathname}
                  substituir={substituir}
                />
              ))}
            </>
          ) : null}
        </div>
      </nav>
    </>
  );
}

function BotaoNovo({ substituir }: { substituir: boolean }) {
  const navegar = useNavigate();
  return (
    <button
      type="button"
      className="item-nav"
      onClick={() => navegar(`/contatos/${criarIdLocal()}`, { replace: substituir })}
    >
      <Plus aria-hidden="true" />
      <span className="rotulo-curto">Novo</span>
    </button>
  );
}

function Atalho({
  item,
  caminho,
  substituir,
}: {
  item: AtalhoItem;
  caminho: string;
  substituir: boolean;
}) {
  const Icone = item.icone;
  const ativo =
    caminho === item.to ||
    caminho.startsWith(`${item.to}/`) ||
    (item.to === '/capturar' && caminho === '/');
  return (
    <Link
      to={item.to}
      replace={substituir}
      className="item-nav"
      aria-current={ativo ? 'page' : undefined}
    >
      <Icone aria-hidden="true" />
      <span className="rotulo-curto">{item.nome}</span>
    </Link>
  );
}
