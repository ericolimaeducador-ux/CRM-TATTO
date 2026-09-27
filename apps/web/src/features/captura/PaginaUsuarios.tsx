import { FormEvent, useEffect, useState, type ReactNode } from 'react';
import { urlDaApi } from '@/lib/api-url';
import { textoDaResposta } from '@/lib/texto-resposta';
import { cabecalhosDaSessao, perfilLogado } from '@/lib/offline/sessao';
import { BotaoCopiar, ConfiguracaoTotp, type DadosInscricao } from './InscricaoTotp';

const PAPEIS = ['vendedor', 'gestor', 'admin', 'auditor'] as const;

interface Usuario {
  id: string;
  login: string;
  nome: string;
  papel: string;
  ativo: boolean;
  trocarSenhaObrigatoria?: boolean;
}

interface TotpDaApi {
  segredoBase32?: string;
  otpauth?: string;
}

/** Dados que o admin entrega à pessoa. Aparecem uma vez e somem ao esconder. */
interface Entrega {
  login: string;
  nome: string;
  senha: string | null;
  totp: DadosInscricao | null;
}

function totpDe(bruto: TotpDaApi | null | undefined): DadosInscricao | null {
  if (!bruto?.segredoBase32) return null;
  return { segredo: bruto.segredoBase32, otpauth: bruto.otpauth ?? '' };
}

export function PaginaUsuarios() {
  const [itens, setItens] = useState<Usuario[]>([]);
  const [mensagem, setMensagem] = useState('');
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [papel, setPapel] = useState<string>('vendedor');
  const [entrega, setEntrega] = useState<Entrega | null>(null);
  const eu = perfilLogado()?.id ?? '';

  useEffect(() => {
    void carregar(setItens, setMensagem);
  }, []);

  async function criar(evento: FormEvent) {
    evento.preventDefault();
    const resposta = await enviar('/v1/usuarios', 'POST', {
      login,
      nome,
      papel,
      ...(senha.trim() ? { senha } : {}),
    });
    if (!resposta.ok) {
      setMensagem(textoDaResposta(resposta.json, 'O usuário não foi criado.'));
      return;
    }
    const dados = resposta.json.dados as {
      login: string;
      nome: string;
      senhaProvisoria?: string | null;
      totp?: TotpDaApi | null;
    };
    setEntrega({
      login: dados.login,
      nome: dados.nome,
      senha: dados.senhaProvisoria ?? null,
      totp: totpDe(dados.totp),
    });
    setLogin('');
    setSenha('');
    setNome('');
    setMensagem('');
    await carregar(setItens, setMensagem);
  }

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Usuários</h1>
      <p className="text-base">
        Mudar perfil, desativar, gerar nova senha e mexer no autenticador pedem o passo extra
        confirmado em Entrar. Criar usuário não pede esse código.
      </p>
      <form className="cartao flex flex-col gap-3" onSubmit={(evento) => void criar(evento)}>
        <h2 className="text-xl font-semibold">Nova conta</h2>
        <Rotulo texto="Login">
          <input
            className={campo}
            autoCapitalize="none"
            value={login}
            onChange={(evento) => setLogin(evento.target.value)}
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
        <Rotulo texto="Senha provisória (opcional)">
          <input
            className={campo}
            type="password"
            autoComplete="new-password"
            value={senha}
            onChange={(evento) => setSenha(evento.target.value)}
          />
        </Rotulo>
        <p className="text-sm">
          Deixe em branco para o sistema gerar uma senha forte. Se digitar, use 12 caracteres ou
          mais. No primeiro acesso a pessoa cria a própria senha.
          {papel === 'admin' ? ' Conta admin já nasce com o autenticador, que aparece aqui.' : ''}
        </p>
        <button type="submit" className="btn">
          Criar usuário
        </button>
      </form>
      {entrega ? (
        <CartaoEntrega
          titulo={`Conta criada: entregue estes dados a ${entrega.nome}`}
          entrega={entrega}
          aoEsconder={() => setEntrega(null)}
        />
      ) : null}
      {mensagem ? (
        <p className="text-base" role="status">
          {mensagem}
        </p>
      ) : null}
      <ul className="flex flex-col gap-3">
        {itens.map((item) => (
          <Linha
            key={item.id}
            item={item}
            propria={item.id === eu}
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
            aoGerarSenha={async () => {
              const resposta = await enviar(`/v1/usuarios/${item.id}/senha/gerar`, 'POST', {});
              if (!resposta.ok) {
                setMensagem(textoDaResposta(resposta.json, 'A senha não mudou.'));
                return null;
              }
              setMensagem('');
              await carregar(setItens, setMensagem);
              const dados = resposta.json.dados as { senhaProvisoria?: string };
              return {
                login: item.login,
                nome: item.nome,
                senha: dados.senhaProvisoria ?? null,
                totp: null,
              };
            }}
            aoRegenerarTotp={async () => {
              const resposta = await enviar(`/v1/usuarios/${item.id}/totp/regenerar`, 'POST', {});
              if (!resposta.ok) {
                setMensagem(textoDaResposta(resposta.json, 'O autenticador continua o mesmo.'));
                return null;
              }
              setMensagem('');
              const dados = resposta.json.dados as { totp?: TotpDaApi };
              return { login: item.login, nome: item.nome, senha: null, totp: totpDe(dados.totp) };
            }}
          />
        ))}
      </ul>
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

function CartaoEntrega({
  titulo,
  entrega,
  aoEsconder,
}: {
  titulo: string;
  entrega: Entrega;
  aoEsconder: () => void;
}) {
  return (
    <div className="entrega-conta" role="region" aria-label={titulo}>
      <h2 className="text-xl font-semibold">{titulo}</h2>
      <p className="text-base">
        Login: <strong>{entrega.login}</strong>
      </p>
      {entrega.senha ? (
        <div className="passo-totp">
          <p className="passo-rotulo">Senha provisória</p>
          <p className="senha-provisoria" data-testid="senha-provisoria">
            {entrega.senha}
          </p>
          <BotaoCopiar texto={entrega.senha} />
          <p className="text-sm">
            Aparece só agora. No primeiro acesso a pessoa entra com ela e cria a própria senha.
          </p>
        </div>
      ) : null}
      {entrega.totp ? (
        <ConfiguracaoTotp
          dados={entrega.totp}
          titulo={`Autenticador da conta ${entrega.login}`}
          paraOutraPessoa
        >
          <p className="text-sm">
            A chave já está ativa e aparece só agora. Depois de salvar no autenticador, a pessoa
            entra com a senha e o código de 6 dígitos. A chave anterior, se havia, deixou de valer.
          </p>
        </ConfiguracaoTotp>
      ) : null}
      <button type="button" className="btn-secundario" onClick={aoEsconder}>
        Já entreguei, esconder
      </button>
    </div>
  );
}

function Linha({
  item,
  propria,
  aoMudar,
  aoZerar,
  aoGerarSenha,
  aoRegenerarTotp,
}: {
  item: Usuario;
  propria: boolean;
  aoMudar: (corpo: { papel?: string; ativo?: boolean }) => Promise<void>;
  aoZerar: () => Promise<void>;
  aoGerarSenha: () => Promise<Entrega | null>;
  aoRegenerarTotp: () => Promise<Entrega | null>;
}) {
  const [papel, setPapel] = useState(item.papel);
  const [confirmar, setConfirmar] = useState<'' | 'senha' | 'totp'>('');
  const [entrega, setEntrega] = useState<Entrega | null>(null);
  const [tipoEntrega, setTipoEntrega] = useState<'senha' | 'totp'>('senha');

  async function executar() {
    const tipo = confirmar;
    setConfirmar('');
    const resultado = tipo === 'senha' ? await aoGerarSenha() : await aoRegenerarTotp();
    if (resultado) {
      setTipoEntrega(tipo === 'totp' ? 'totp' : 'senha');
      setEntrega(resultado);
    }
  }

  return (
    <li className="cartao flex flex-col gap-2">
      <p className="text-base">
        {item.nome} ({item.login}) · {item.ativo ? item.papel : 'inativo'}
        {item.trocarSenhaObrigatoria ? ' · aguardando a pessoa criar a senha' : ''}
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
      {propria ? null : (
        <button type="button" className="btn-secundario" onClick={() => setConfirmar('senha')}>
          Gerar nova senha
        </button>
      )}
      {!propria && item.papel === 'admin' ? (
        <button type="button" className="btn-secundario" onClick={() => setConfirmar('totp')}>
          Regenerar 2FA
        </button>
      ) : null}
      <button type="button" className="btn-secundario" onClick={() => void aoZerar()}>
        Resetar autenticador
      </button>
      {confirmar ? (
        <div className="confirmacao-acao" role="group" aria-label="Confirmar ação">
          <p className="text-base">
            {confirmar === 'senha'
              ? `Gerar uma senha provisória nova para ${item.nome}? A senha atual deixa de valer, as sessões abertas são encerradas e a pessoa cria outra no próximo acesso.`
              : `Gerar um autenticador novo para ${item.nome}? O código atual deixa de valer e as sessões abertas são encerradas.`}
          </p>
          <button type="button" className="btn" onClick={() => void executar()}>
            {confirmar === 'senha' ? 'Confirmar nova senha' : 'Confirmar novo 2FA'}
          </button>
          <button type="button" className="btn-secundario" onClick={() => setConfirmar('')}>
            Cancelar
          </button>
        </div>
      ) : null}
      {entrega ? (
        <CartaoEntrega
          titulo={
            tipoEntrega === 'senha'
              ? `Nova senha provisória de ${entrega.nome}`
              : `Novo autenticador de ${entrega.nome}`
          }
          entrega={entrega}
          aoEsconder={() => setEntrega(null)}
        />
      ) : null}
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
  try {
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
  } catch {
    return { ok: false, json: { mensagem: 'Sem conexão com o servidor. Nada foi alterado.' } };
  }
}
