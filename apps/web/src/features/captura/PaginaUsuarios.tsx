import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { urlDaApi } from '@/lib/api-url';
import { textoDaResposta } from '@/lib/texto-resposta';
import { cabecalhosDaSessao, perfilLogado } from '@/lib/offline/sessao';

const PAPEIS = {
  vendedor: 'Vendedor',
  gestor: 'Gestor',
  admin: 'Administrador',
  auditor: 'Auditor',
};
interface Usuario {
  id: string;
  login: string;
  nome: string;
  papel: string;
  ativo: boolean;
}

export function PaginaUsuarios() {
  const [itens, setItens] = useState<Usuario[]>([]);
  const [mensagem, setMensagem] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [criando, setCriando] = useState(false);
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [papel, setPapel] = useState('vendedor');
  const criandoRef = useRef(false);
  const admin = perfilLogado()?.papel === 'admin';

  const carregar = useCallback(async () => {
    if (!admin) {
      setCarregando(false);
      return;
    }
    setCarregando(true);
    try {
      const resposta = await enviar('/v1/usuarios', 'GET');
      if (!resposta.ok) {
        setMensagem(
          textoDaResposta(resposta.json, 'Não foi possível carregar os usuários. Tente novamente.'),
        );
        return;
      }
      setItens(Array.isArray(resposta.json.dados) ? (resposta.json.dados as Usuario[]) : []);
    } finally {
      setCarregando(false);
    }
  }, [admin]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function criar(evento: FormEvent) {
    evento.preventDefault();
    if (criandoRef.current) return;
    criandoRef.current = true;
    setCriando(true);
    setMensagem('');
    try {
      const resposta = await enviar('/v1/usuarios', 'POST', { login, senha, nome, papel });
      if (!resposta.ok) {
        setMensagem(textoDaResposta(resposta.json, 'O usuário não foi criado.'));
        return;
      }
      setLogin('');
      setSenha('');
      setNome('');
      setMensagem(
        'Usuário criado. Entregue o usuário e a senha à pessoa para que ela entre no CRM.',
      );
      await carregar();
    } finally {
      criandoRef.current = false;
      setCriando(false);
    }
  }

  if (!admin)
    return (
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Usuários</h1>
        <p>Entre com um perfil de administrador para gerenciar a equipe.</p>
        <Link className="tv-button tv-button-primary" to="/entrar">
          Entrar no Tela Viva
        </Link>
      </section>
    );

  return (
    <section className="tv-users-page flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Usuários</h1>
      <p>Cadastre as pessoas do time. O perfil Administrador também pode criar outros usuários.</p>
      <form className="flex flex-col gap-3" onSubmit={(e) => void criar(e)} aria-busy={criando}>
        <h2 className="text-xl font-semibold">Novo usuário</h2>
        <fieldset disabled={criando} className="flex min-w-0 flex-col gap-3">
          <label className="tv-field">
            <span>Nome</span>
            <input
              required
              autoComplete="name"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </label>
          <label className="tv-field">
            <span>Usuário</span>
            <input
              required
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={login}
              onChange={(e) => setLogin(e.target.value)}
            />
          </label>
          <label className="tv-field">
            <span>Senha de 12 caracteres ou mais</span>
            <input
              required
              minLength={12}
              type="password"
              autoComplete="new-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </label>
          <label className="tv-field">
            <span>Perfil</span>
            <select value={papel} onChange={(e) => setPapel(e.target.value)}>
              {Object.entries(PAPEIS).map(([valor, texto]) => (
                <option key={valor} value={valor}>
                  {texto}
                </option>
              ))}
            </select>
          </label>
          <p className="text-base">
            Vendedor acompanha sua carteira. Gestor acompanha o time. Administrador gerencia os
            acessos. Auditor consulta sem editar.
          </p>
          <button type="submit" className="tv-button tv-button-primary" disabled={criando}>
            {criando ? 'Criando…' : 'Criar usuário'}
          </button>
        </fieldset>
      </form>
      {mensagem ? <p role="status">{mensagem}</p> : null}
      <h2 className="text-xl font-semibold">Pessoas do time</h2>
      <p>
        Alterar perfil, desativar e resetar autenticador pedem confirmação em{' '}
        <Link className="underline" to="/minha-conta">
          Minha conta
        </Link>
        . Criar usuários não pede código.
      </p>
      <button
        type="button"
        className="tv-button tv-button-light"
        disabled={carregando}
        onClick={() => void carregar()}
      >
        {carregando ? 'Carregando usuários…' : 'Atualizar lista'}
      </button>
      {!carregando && itens.length === 0 ? (
        <p>Nenhum usuário na lista. Atualize para conferir os acessos.</p>
      ) : null}
      <ul className="flex flex-col gap-3" aria-busy={carregando}>
        {itens.map((item) => (
          <Linha
            key={item.id}
            item={item}
            aoEnviar={async (caminho, metodo, corpo) => {
              const resposta = await enviar(caminho, metodo, corpo);
              setMensagem(
                resposta.ok
                  ? 'Usuário atualizado.'
                  : textoDaResposta(
                      resposta.json,
                      'Nada foi alterado. Confirme o código em Minha conta.',
                    ),
              );
              if (resposta.ok) await carregar();
            }}
          />
        ))}
      </ul>
    </section>
  );
}

const campo = 'min-h-12 min-w-0 rounded border border-stone-300 px-3';
function perfilTexto(papel: string) {
  return PAPEIS[papel as keyof typeof PAPEIS] ?? papel;
}

function Linha({
  item,
  aoEnviar,
}: {
  item: Usuario;
  aoEnviar: (caminho: string, metodo: string, corpo: unknown) => Promise<void>;
}) {
  const [papel, setPapel] = useState(item.papel);
  const [acao, setAcao] = useState<'perfil' | 'ativo' | 'totp' | null>(null);
  const [enviando, setEnviando] = useState(false);
  const envio = useRef(false);
  useEffect(() => {
    setPapel(item.papel);
  }, [item.papel]);
  async function confirmar() {
    if (!acao || envio.current) return;
    envio.current = true;
    setEnviando(true);
    try {
      await aoEnviar(
        `/v1/usuarios/${item.id}${acao === 'totp' ? '/totp/zerar' : ''}`,
        acao === 'totp' ? 'POST' : 'PATCH',
        acao === 'perfil' ? { papel } : acao === 'ativo' ? { ativo: !item.ativo } : {},
      );
      setAcao(null);
    } finally {
      envio.current = false;
      setEnviando(false);
    }
  }
  return (
    <li className="flex min-w-0 flex-col gap-3 rounded border border-stone-300 p-4">
      <p className="break-words">
        <strong>{item.nome}</strong> ({item.login}) · {perfilTexto(item.papel)} ·{' '}
        {item.ativo ? 'Ativo' : 'Inativo'}
      </p>
      <label className="flex flex-col gap-1">
        Perfil de {item.nome}
        <select
          className={campo}
          value={papel}
          disabled={enviando}
          onChange={(e) => setPapel(e.target.value)}
        >
          {Object.entries(PAPEIS).map(([valor, texto]) => (
            <option key={valor} value={valor}>
              {texto}
            </option>
          ))}
        </select>
      </label>
      <button
        className="tv-button tv-button-light"
        disabled={enviando}
        onClick={() => setAcao('perfil')}
      >
        Definir perfil
      </button>
      <button
        className="tv-button tv-button-light"
        disabled={enviando}
        onClick={() => setAcao('ativo')}
      >
        {item.ativo ? 'Desativar' : 'Reativar'}
      </button>
      <button
        className="tv-button tv-button-light"
        disabled={enviando}
        onClick={() => setAcao('totp')}
      >
        Resetar autenticador
      </button>
      {acao ? (
        <div className="flex flex-col gap-2 rounded border border-stone-300 p-3">
          <p>
            {acao === 'perfil'
              ? `O perfil de ${item.nome} passará a ${perfilTexto(papel)}.`
              : acao === 'ativo'
                ? item.ativo
                  ? `${item.nome} perderá o acesso ao CRM.`
                  : `${item.nome} poderá entrar novamente.`
                : `O autenticador de ${item.nome} será removido e suas sessões serão encerradas. A pessoa poderá configurar outro em Minha conta.`}
          </p>
          <button
            className="tv-button tv-button-primary"
            disabled={enviando}
            onClick={() => void confirmar()}
          >
            {enviando ? 'Confirmando…' : 'Confirmar alteração'}
          </button>
          <button
            className="tv-button tv-button-light"
            disabled={enviando}
            onClick={() => setAcao(null)}
          >
            Cancelar
          </button>
        </div>
      ) : null}
    </li>
  );
}

async function enviar(
  caminho: string,
  metodo: string,
  corpo?: unknown,
): Promise<{
  ok: boolean;
  json: { dados?: unknown; erros?: { mensagem?: string }[]; mensagem?: string };
}> {
  try {
    const resposta = await fetch(urlDaApi(caminho), {
      method: metodo,
      headers: cabecalhosDaSessao(),
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    return {
      ok: resposta.ok,
      json: (await resposta.json()) as {
        dados?: unknown;
        erros?: { mensagem?: string }[];
        mensagem?: string;
      },
    };
  } catch {
    return {
      ok: false,
      json: {
        mensagem:
          metodo === 'GET'
            ? 'Não consegui carregar os usuários. Confira sua conexão e atualize a lista.'
            : 'Não consegui confirmar a alteração. Confira sua conexão e atualize a lista antes de tentar novamente.',
      },
    };
  }
}
