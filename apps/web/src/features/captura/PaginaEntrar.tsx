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
    // No primeiro acesso do administrador a inscrição do autenticador vem antes de tudo:
    // fica nesta tela, onde está o botão Inscrever autenticador.
    const gerente = usuario?.papel === 'admin' || usuario?.papel === 'gestor';
    if (gerente && json.dados.precisaInscreverTotp !== true) navegar('/cadastros');
  }

  return (
    <section className="entrar-palco">
      <aside className="entrar-marca">
        <Marca grande clara />
        <span className="fio-ouro" aria-hidden="true" />
      </aside>
      <div className="entrar-cartao">
        <div className="entrar-logo-movel">
          <Marca grande central />
        </div>
        <h1 className="text-3xl font-semibold">Entrar</h1>
        <form className="flex flex-col gap-4" onSubmit={(evento) => void entrar(evento)}>
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
            aoSair={() => setToken('')}
          />
        ) : null}
        {token && !totpPendenteLocal() ? <PainelPlanilha aoMensagem={setMensagem} /> : null}
        {mensagem ? (
          <p className="toast" role="status">
            {mensagem}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function textoDe(json: RespostaJson, reserva: string): string {
  return json.erros?.[0]?.mensagem ?? json.mensagem ?? reserva;
}
