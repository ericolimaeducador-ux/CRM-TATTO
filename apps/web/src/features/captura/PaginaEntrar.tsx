import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { urlDaApi } from '@/lib/api-url';
import { guardarPerfil, guardarToken, marcarTotpPendente } from '@/lib/offline/sessao';
import { textoDaResposta } from '@/lib/texto-resposta';

interface RespostaJson {
  mensagem?: string;
  erros?: { mensagem?: string }[];
  dados?: { token?: string; usuario?: { id?: string; papel?: string; nome?: string } };
}

export function PaginaEntrar() {
  const navegar = useNavigate();
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [entrando, setEntrando] = useState(false);
  const envio = useRef(false);

  async function entrar(evento: FormEvent) {
    evento.preventDefault();
    if (envio.current) return;
    envio.current = true;
    setEntrando(true);
    setMensagem('');
    try {
      const resposta = await fetch(urlDaApi('/v1/auth/entrar'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ login, senha }),
      });
      const json = (await resposta.json()) as RespostaJson;
      const usuario = json.dados?.usuario;
      if (!resposta.ok || !json.dados?.token || !usuario?.id || !usuario.papel || !usuario.nome) {
        setMensagem(textoDaResposta(json, 'Não foi possível entrar. Confira usuário e senha.'));
        return;
      }
      guardarPerfil({ id: usuario.id, papel: usuario.papel, nome: usuario.nome });
      marcarTotpPendente(false);
      guardarToken(json.dados.token);
      setSenha('');
      navegar('/', { replace: true });
    } catch {
      setMensagem('Não consegui conectar ao Tela Viva. Confira sua conexão e tente novamente.');
    } finally {
      envio.current = false;
      setEntrando(false);
    }
  }

  return (
    <section className="tv-login-card" aria-labelledby="titulo-entrar">
      <img
        className="tv-login-logo"
        src={`${import.meta.env.BASE_URL}brand/telaviva-lockup.svg`}
        alt="Tela Viva — cuidados para pele tatuada"
      />
      <h1 id="titulo-entrar">Entrar no CRM</h1>
      <p className="tv-login-intro">Use o usuário e a senha fornecidos pelo administrador.</p>
      <form
        className="tv-login-form"
        onSubmit={(evento) => void entrar(evento)}
        aria-busy={entrando}
      >
        <label className="tv-field">
          <span>Usuário</span>
          <input
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={login}
            onChange={(evento) => setLogin(evento.target.value)}
          />
        </label>
        <label className="tv-field">
          <span>Senha</span>
          <input
            name="password"
            type={mostrarSenha ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={senha}
            onChange={(evento) => setSenha(evento.target.value)}
          />
        </label>
        <label className="tv-login-show-password">
          <input
            type="checkbox"
            checked={mostrarSenha}
            onChange={(e) => setMostrarSenha(e.target.checked)}
          />
          Mostrar senha
        </label>
        {mensagem ? (
          <p className="tv-login-error" role="alert">
            {mensagem}
          </p>
        ) : null}
        <button type="submit" disabled={entrando} className="tv-button tv-button-primary">
          {entrando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      <footer className="tv-login-company">
        Tela Viva · JSETTE7
        <br />
        CNPJ 54.765.439/0001-34
      </footer>
    </section>
  );
}
