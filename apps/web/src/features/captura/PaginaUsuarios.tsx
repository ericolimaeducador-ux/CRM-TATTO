import { FormEvent, useEffect, useState, type ReactNode } from 'react';
import { urlDaApi } from '@/lib/api-url';
import { textoDaResposta } from '@/lib/texto-resposta';
import { cabecalhosDaSessao } from '@/lib/offline/sessao';

const PAPEIS = ['vendedor', 'gestor', 'admin', 'auditor'] as const;

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
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [papel, setPapel] = useState<string>('vendedor');

  useEffect(() => {
    void carregar(setItens, setMensagem);
  }, []);

  async function criar(evento: FormEvent) {
    evento.preventDefault();
    const resposta = await enviar('/v1/usuarios', 'POST', { login, senha, nome, papel });
    if (!resposta.ok) {
      setMensagem(textoDaResposta(resposta.json, 'O usuário não foi criado.'));
      return;
    }
    setLogin('');
    setSenha('');
    setNome('');
    setMensagem('Usuário criado. A senha não aparece de novo.');
    await carregar(setItens, setMensagem);
  }

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Usuários</h1>
      <p className="text-base">
        Mudar perfil, desativar e resetar o autenticador pedem o passo extra confirmado em Entrar.
        Criar usuário não pede esse código.
      </p>
      <form className="flex flex-col gap-3" onSubmit={(evento) => void criar(evento)}>
        <Rotulo texto="Login">
          <input
            className={campo}
            value={login}
            onChange={(evento) => setLogin(evento.target.value)}
          />
        </Rotulo>
        <Rotulo texto="Senha de 12 caracteres ou mais">
          <input
            className={campo}
            type="password"
            value={senha}
            onChange={(evento) => setSenha(evento.target.value)}
          />
        </Rotulo>
        <Rotulo texto="Nome">
          <input
            className={campo}
            value={nome}
            onChange={(evento) => setNome(evento.target.value)}
          />
        </Rotulo>
        <Rotulo texto="Perfil">
          <select
            className={campo}
            value={papel}
            onChange={(evento) => setPapel(evento.target.value)}
          >
            {PAPEIS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Rotulo>
        <button type="submit" className="btn">
          Criar usuário
        </button>
      </form>
      <ul className="flex flex-col gap-3">
        {itens.map((item) => (
          <Linha
            key={item.id}
            item={item}
            aoMudar={async (corpo) => {
              const resposta = await enviar(`/v1/usuarios/${item.id}`, 'PATCH', corpo);
              setMensagem(
                resposta.ok
                  ? 'Perfil atualizado.'
                  : textoDaResposta(resposta.json, 'Nada foi alterado. Confirme o passo extra.'),
              );
              if (resposta.ok) await carregar(setItens, setMensagem);
            }}
            aoZerar={async () => {
              const resposta = await enviar(`/v1/usuarios/${item.id}/totp/zerar`, 'POST', {});
              setMensagem(
                resposta.ok
                  ? 'Autenticador resetado. A pessoa inscreve de novo em Entrar.'
                  : textoDaResposta(resposta.json, 'O autenticador continua o mesmo.'),
              );
            }}
          />
        ))}
      </ul>
      {mensagem ? <p className="text-base">{mensagem}</p> : null}
    </section>
  );
}

const campo = 'campo';

function Rotulo({ texto, children }: { texto: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-base">
      {texto}
      {children}
    </label>
  );
}

function Linha({
  item,
  aoMudar,
  aoZerar,
}: {
  item: Usuario;
  aoMudar: (corpo: { papel?: string; ativo?: boolean }) => Promise<void>;
  aoZerar: () => Promise<void>;
}) {
  const [papel, setPapel] = useState(item.papel);
  return (
    <li className="cartao flex flex-col gap-2">
      <p className="text-base">
        {item.nome} ({item.login}) · {item.ativo ? item.papel : 'inativo'}
      </p>
      <select className={campo} value={papel} onChange={(evento) => setPapel(evento.target.value)}>
        {PAPEIS.map((opcao) => (
          <option key={opcao} value={opcao}>
            {opcao}
          </option>
        ))}
      </select>
      <button type="button" className="btn-secundario" onClick={() => void aoMudar({ papel })}>
        Definir perfil
      </button>
      <button
        type="button"
        className="btn-secundario"
        onClick={() => void aoMudar({ ativo: !item.ativo })}
      >
        {item.ativo ? 'Desativar' : 'Reativar'}
      </button>
      <button type="button" className="btn-secundario" onClick={() => void aoZerar()}>
        Resetar autenticador
      </button>
    </li>
  );
}

async function carregar(
  definir: (itens: Usuario[]) => void,
  definirMensagem: (texto: string) => void,
): Promise<void> {
  const resposta = await enviar('/v1/usuarios', 'GET');
  if (!resposta.ok) {
    definirMensagem(textoDaResposta(resposta.json, 'Só o admin vê os usuários.'));
    return;
  }
  const dados = resposta.json.dados;
  definir(Array.isArray(dados) ? (dados as Usuario[]) : []);
}

async function enviar(
  caminho: string,
  metodo: string,
  corpo?: unknown,
): Promise<{
  ok: boolean;
  json: { dados?: unknown; erros?: { mensagem?: string }[]; mensagem?: string };
}> {
  const resposta = await fetch(urlDaApi(caminho), {
    method: metodo,
    headers: cabecalhosDaSessao(),
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const json = (await resposta.json()) as {
    dados?: unknown;
    erros?: { mensagem?: string }[];
    mensagem?: string;
  };
  return { ok: resposta.ok, json };
}
