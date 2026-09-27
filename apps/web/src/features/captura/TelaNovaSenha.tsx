import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchComAcordar } from '@/lib/acordar';
import { urlDaApi } from '@/lib/api-url';
import {
  cabecalhosDaSessao,
  limparSessao,
  marcarTrocaSenha,
  perfilLogado,
  totpPendenteLocal,
} from '@/lib/offline/sessao';
import { Marca } from '../marca/Marca';

/**
 * Primeiro acesso com senha provisória (conta criada ou senha gerada pelo admin):
 * só esta tela aparece até a pessoa criar a própria senha. A API recusa as outras
 * ações enquanto isso (SENHA_PROVISORIA).
 */
export function TelaNovaSenha({ aoConcluir }: { aoConcluir?: () => void }) {
  const navegar = useNavigate();
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    if (nova.trim().length < 12) {
      setMensagem('A senha nova precisa de 12 caracteres ou mais.');
      return;
    }
    if (nova !== confirmacao) {
      setMensagem('A confirmação não é igual à senha nova.');
      return;
    }
    if (nova.trim() === atual.trim()) {
      setMensagem('A senha nova precisa ser diferente da provisória.');
      return;
    }
    setEnviando(true);
    try {
      const resposta = await fetchComAcordar(urlDaApi('/v1/auth/senha'), {
        method: 'POST',
        headers: cabecalhosDaSessao(),
        body: JSON.stringify({ senhaAtual: atual, senhaNova: nova }),
      });
      const json = (await resposta.json()) as {
        mensagem?: string;
        erros?: { mensagem?: string }[];
      };
      if (!resposta.ok) {
        setMensagem(json.erros?.[0]?.mensagem ?? json.mensagem ?? 'A senha não mudou.');
        return;
      }
    } catch {
      setMensagem('Sem conexão com o servidor. A senha não mudou; tente de novo.');
      return;
    } finally {
      setEnviando(false);
    }
    marcarTrocaSenha(false);
    aoConcluir?.();
    const papel = perfilLogado()?.papel;
    if (totpPendenteLocal()) navegar('/entrar', { replace: true });
    else if (papel === 'admin' || papel === 'gestor') navegar('/cadastros', { replace: true });
    else navegar('/capturar', { replace: true });
  }

  function sair() {
    limparSessao();
    aoConcluir?.();
    navegar('/entrar', { replace: true });
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
        <h1 className="text-3xl font-semibold">Crie sua nova senha</h1>
        <p className="text-base">
          Você entrou com uma senha provisória. Para continuar, crie a sua senha. Ela precisa de 12
          caracteres ou mais e só você deve saber.
        </p>
        <form className="flex flex-col gap-4" onSubmit={(evento) => void salvar(evento)}>
          <label className="flex flex-col gap-1 text-base">
            Senha provisória
            <input
              className="campo"
              type="password"
              autoComplete="current-password"
              value={atual}
              onChange={(evento) => setAtual(evento.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-base">
            Senha nova
            <input
              className="campo"
              type="password"
              autoComplete="new-password"
              value={nova}
              onChange={(evento) => setNova(evento.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-base">
            Confirme a senha nova
            <input
              className="campo"
              type="password"
              autoComplete="new-password"
              value={confirmacao}
              onChange={(evento) => setConfirmacao(evento.target.value)}
            />
          </label>
          <button type="submit" className="btn" disabled={enviando}>
            Salvar senha nova
          </button>
        </form>
        <button type="button" className="btn-secundario" onClick={sair}>
          Sair
        </button>
        {mensagem ? (
          <p className="toast" role="status">
            {mensagem}
          </p>
        ) : null}
      </div>
    </section>
  );
}
