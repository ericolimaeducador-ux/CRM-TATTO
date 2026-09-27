import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchComAcordar, FRASE_ACORDANDO } from '@/lib/acordar';
import { urlDaApi } from '@/lib/api-url';
import {
  guardarPerfil,
  guardarToken,
  marcarTotpPendente,
  tokenDaSessao,
  totpPendenteLocal,
} from '@/lib/offline/sessao';
import { Marca } from '../marca/Marca';
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
  const navegar = useNavigate();
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [codigo, setCodigo] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [token, setToken] = useState(tokenDaSessao);
  const [segredo, setSegredo] = useState('');

  async function entrar(evento: FormEvent) {
    evento.preventDefault();
    let resposta: Response;
    try {
      resposta = await fetchComAcordar(
        urlDaApi('/v1/auth/entrar'),
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ login, senha, codigoTotp: codigo || undefined }),
        },
        setMensagem,
      );
    } catch {
      setMensagem(`${FRASE_ACORDANDO} Não consegui entrar. Tente de novo.`);
      return;
    }
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
    if (usuario?.papel === 'admin' || usuario?.papel === 'gestor') navegar('/cadastros');
  }

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-4">
      <Marca grande />
      <h1 className="text-3xl font-semibold">Entrar</h1>
      <form className="flex flex-col gap-3" onSubmit={(evento) => void entrar(evento)}>
        <label className="flex flex-col gap-1 text-base">
          Usuário
          <input
            className="campo"
            autoComplete="username"
            value={login}
            onChange={(evento) => setLogin(evento.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-base">
          Senha
          <input
            className="campo"
            type="password"
            autoComplete="current-password"
            value={senha}
            onChange={(evento) => setSenha(evento.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-base">
          Código do autenticador, obrigatório se você já inscreveu
          <input
            className="campo"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={codigo}
            onChange={(evento) => setCodigo(evento.target.value)}
          />
        </label>
        <button type="submit" className="btn">
          Entrar
        </button>
      </form>
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
      {mensagem ? <p className="text-base">{mensagem}</p> : null}
    </section>
  );
}

function textoDe(json: RespostaJson, reserva: string): string {
  return json.erros?.[0]?.mensagem ?? json.mensagem ?? reserva;
}
