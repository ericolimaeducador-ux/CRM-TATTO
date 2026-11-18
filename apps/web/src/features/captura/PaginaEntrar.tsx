import { FormEvent, useState } from 'react';

import { urlDaApi } from '@/lib/api-url';
import {
  guardarPerfil,
  guardarToken,
  marcarTotpPendente,
  tokenDaSessao,
  totpPendenteLocal,
} from '@/lib/offline/sessao';
import { PainelConta } from './PainelConta';
import { PainelPlanilha } from './PainelPlanilha';

interface RespostaJson {
  mensagem?: string;
  erros?: { mensagem?: string }[];
  dados?: {
    token?: string;
    precisaInscreverTotp?: boolean;
    usuario?: { id?: string; papel?: string; nome?: string };
  };
}

export function PaginaEntrar() {
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [codigo, setCodigo] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [token, setToken] = useState(tokenDaSessao);
  const [segredo, setSegredo] = useState('');
  const [entrando, setEntrando] = useState(false);

  async function entrar(evento: FormEvent) {
    evento.preventDefault();
    setEntrando(true);
    setMensagem('');
    try {
      const resposta = await fetch(urlDaApi('/v1/auth/entrar'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ login, senha, codigoTotp: codigo || undefined }),
      });
      const json = (await resposta.json()) as RespostaJson;
      if (!resposta.ok || !json.dados?.token) {
        setMensagem(textoDe(json, 'Usuário ou senha não conferem.'));
        return;
      }
      guardarToken(json.dados.token);
      marcarTotpPendente(json.dados.precisaInscreverTotp === true);
      const usuario = json.dados.usuario;
      if (usuario?.id && usuario.papel && usuario.nome) {
        guardarPerfil({ id: usuario.id, papel: usuario.papel, nome: usuario.nome });
      }
      setToken(json.dados.token);
      setMensagem(`Entrou como ${usuario?.nome ?? login}.`);
    } catch {
      setMensagem(
        'Não consegui conectar ao Tela Viva. Confira sua conexão e tente novamente. A captura continua disponível neste aparelho.',
      );
    } finally {
      setEntrando(false);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <img
        className="tv-login-logo"
        src={`${import.meta.env.BASE_URL}brand/telaviva-lockup.svg`}
        alt="Tela Viva — cuidados para pele tatuada"
      />
      <h1 className="text-2xl font-semibold">Entrar</h1>
      <p className="tv-login-intro">
        Sua carteira, seus encontros e seus próximos passos. Entre com o usuário fornecido pela
        gestão.
      </p>
      <form className="flex flex-col gap-3" onSubmit={(evento) => void entrar(evento)}>
        <label className="flex flex-col gap-1 text-base">
          Usuário
          <input
            className="min-h-12 rounded border border-stone-400 px-3"
            autoComplete="username"
            value={login}
            onChange={(evento) => setLogin(evento.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-base">
          Senha
          <input
            className="min-h-12 rounded border border-stone-400 px-3"
            type="password"
            autoComplete="current-password"
            value={senha}
            onChange={(evento) => setSenha(evento.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-base">
          Código do autenticador, obrigatório se você já inscreveu
          <input
            className="min-h-12 rounded border border-stone-400 px-3"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={codigo}
            onChange={(evento) => setCodigo(evento.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={entrando}
          className="min-h-12 rounded-lg bg-stone-900 px-4 text-base text-white"
        >
          {entrando ? 'Conectando…' : 'Entrar'}
        </button>
      </form>
      {token ? (
        <a className="tv-button tv-button-primary" href={import.meta.env.BASE_URL}>
          Abrir minha carteira
        </a>
      ) : null}
      {token ? (
        <PainelConta
          codigo={codigo}
          pendente={totpPendenteLocal()}
          aoMensagem={setMensagem}
          aoSegredo={setSegredo}
          aoSair={() => {
            setToken('');
            setSegredo('');
          }}
        />
      ) : null}
      {token && !totpPendenteLocal() ? <PainelPlanilha aoMensagem={setMensagem} /> : null}
      {segredo ? (
        <p className="break-all text-base" data-testid="segredo-totp">
          {segredo}
        </p>
      ) : null}
      {mensagem ? (
        <p className="text-base" role="status">
          {mensagem}
        </p>
      ) : null}
      <footer className="tv-login-company">
        Tela Viva — Cuidados para Pele Tatuada
        <br />
        JSETTE7 Comércio de Produtos Médicos e Hospitalares LTDA
        <br />
        CNPJ 54.765.439/0001-34
      </footer>
    </section>
  );
}

function textoDe(json: RespostaJson, reserva: string): string {
  return json.erros?.[0]?.mensagem ?? json.mensagem ?? reserva;
}
