import { useState } from 'react';
import { Link } from 'react-router-dom';
import { perfilLogado, podeImportar, tokenDaSessao } from '@/lib/offline/sessao';
import { PainelConta } from './PainelConta';
import { PainelPlanilha } from './PainelPlanilha';

export function PaginaMinhaConta() {
  const [token, setToken] = useState(tokenDaSessao);
  const [mensagem, setMensagem] = useState('');
  const perfil = perfilLogado();
  return (
    <section className="tv-account-page flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Minha conta</h1>
      {mensagem ? (
        <p className="text-base" role="status">
          {mensagem}
        </p>
      ) : null}
      {token ? (
        <>
          <p className="text-base">
            Conectado como <strong>{perfil?.nome ?? 'usuário'}</strong>.
          </p>
          {perfil?.papel === 'admin' ? (
            <Link className="tv-button tv-button-primary" to="/usuarios">
              Gerenciar usuários
            </Link>
          ) : null}
          <PainelConta aoMensagem={setMensagem} aoSair={() => setToken('')} />
          {podeImportar() ? (
            <details className="tv-account-details">
              <summary>Importar e exportar planilhas</summary>
              <PainelPlanilha aoMensagem={setMensagem} />
            </details>
          ) : null}
        </>
      ) : (
        <Link className="tv-button tv-button-primary" to="/entrar">
          Entrar no Tela Viva
        </Link>
      )}
    </section>
  );
}
