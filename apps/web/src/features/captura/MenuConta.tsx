import { FormEvent, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { KeyRound, LogIn, LogOut } from 'lucide-react';
import { fetchComAcordar } from '@/lib/acordar';
import { urlDaApi } from '@/lib/api-url';
import { cabecalhosDaSessao, limparSessao, perfilLogado } from '@/lib/offline/sessao';

export function MenuConta({ painelAberto }: { painelAberto?: boolean }) {
  const perfil = perfilLogado();
  const local = useLocation();
  const [aberto, setAberto] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [senhaAtual, setSenhaAtual] = useState('');
  const [senhaNova, setSenhaNova] = useState('');

  // Fecha junto com o painel "Mais" e a cada troca de rota.
  useEffect(() => {
    if (!painelAberto) setAberto(false);
  }, [painelAberto]);

  useEffect(() => {
    setAberto(false);
  }, [local.key]);

  useEffect(() => {
    if (!aberto) return undefined;
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') setAberto(false);
    }
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [aberto]);

  if (!perfil) {
    return (
      <Link to="/entrar" className="item-nav">
        <LogIn aria-hidden="true" />
        <span className="rotulo-curto">Entrar</span>
      </Link>
    );
  }

  async function sair() {
    let aviso = '';
    try {
      const resposta = await fetchComAcordar(
        urlDaApi('/v1/auth/sair'),
        { method: 'POST', headers: cabecalhosDaSessao() },
        setMensagem,
      );
      if (!resposta.ok) aviso = ' O servidor pode ainda guardar a sessão.';
    } catch {
      aviso = ' Sem rede, o servidor pode ainda guardar a sessão.';
    }
    limparSessao();
    setMensagem(`Sessão encerrada neste aparelho.${aviso}`);
    window.location.assign('/entrar');
  }

  async function trocarSenha(evento: FormEvent) {
    evento.preventDefault();
    try {
      const resposta = await fetchComAcordar(urlDaApi('/v1/auth/senha'), {
        method: 'POST',
        headers: cabecalhosDaSessao(),
        body: JSON.stringify({ senhaAtual, senhaNova }),
      });
      const json = (await resposta.json()) as {
        mensagem?: string;
        erros?: { mensagem?: string }[];
      };
      if (!resposta.ok) {
        setMensagem(json.erros?.[0]?.mensagem ?? json.mensagem ?? 'A senha não mudou.');
        return;
      }
      setSenhaAtual('');
      setSenhaNova('');
      setMensagem('Senha trocada. As outras sessões foram encerradas.');
    } catch {
      setMensagem('A senha não mudou.');
    }
  }

  return (
    <div className="conta">
      <button
        type="button"
        className="item-nav"
        aria-expanded={aberto}
        aria-haspopup="true"
        onClick={() => setAberto((valor) => !valor)}
      >
        <KeyRound aria-hidden="true" />
        <span className="rotulo-curto">{perfil.nome}</span>
      </button>
      <div className={aberto ? 'conta-painel aberto' : 'conta-painel'} hidden={!aberto}>
        <form className="flex flex-col gap-2" onSubmit={(evento) => void trocarSenha(evento)}>
          <label className="flex flex-col gap-1 text-sm">
            Senha atual
            <input
              className="campo"
              type="password"
              autoComplete="current-password"
              value={senhaAtual}
              onChange={(evento) => setSenhaAtual(evento.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Senha nova
            <input
              className="campo"
              type="password"
              autoComplete="new-password"
              value={senhaNova}
              onChange={(evento) => setSenhaNova(evento.target.value)}
            />
          </label>
          <button type="submit" className="btn-secundario">
            Trocar senha
          </button>
        </form>
        <button type="button" className="item-nav" onClick={() => void sair()}>
          <LogOut aria-hidden="true" />
          Sair
        </button>
        {mensagem ? (
          <p className="toast" role="status">
            {mensagem}
          </p>
        ) : null}
      </div>
    </div>
  );
}
