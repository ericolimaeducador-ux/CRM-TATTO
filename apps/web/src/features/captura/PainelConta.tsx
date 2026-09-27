import { FormEvent, useState } from 'react';
import { fetchComAcordar } from '@/lib/acordar';
import { urlDaApi } from '@/lib/api-url';
import { cabecalhosDaSessao, limparSessao, marcarTotpPendente } from '@/lib/offline/sessao';

interface RespostaJson {
  mensagem?: string;
  erros?: { mensagem?: string }[];
  dados?: { segredoBase32?: string; pendente?: boolean };
}

export function PainelConta({
  codigo,
  pendente,
  aoMensagem,
  aoSegredo,
  aoSair,
}: {
  codigo: string;
  pendente: boolean;
  aoMensagem: (texto: string) => void;
  aoSegredo: (segredo: string) => void;
  aoSair: () => void;
}) {
  const [senhaAtual, setSenhaAtual] = useState('');
  const [senhaNova, setSenhaNova] = useState('');

  async function inscrever() {
    const resposta = await chamar('/v1/auth/totp/inscrever', { codigoTotp: codigo || undefined });
    if (!resposta?.ok || !resposta.json.dados?.segredoBase32) {
      aoMensagem(textoDe(resposta?.json, 'O autenticador não foi inscrito.'));
      return;
    }
    aoSegredo(resposta.json.dados.segredoBase32);
    aoMensagem(
      'Segredo pendente. Guarde no aplicativo autenticador e confirme um código válido para ativar.',
    );
  }

  async function ativar() {
    const resposta = await chamar('/v1/auth/totp/ativar', { codigoTotp: codigo });
    if (!resposta?.ok) {
      aoMensagem(textoDe(resposta?.json, 'O autenticador não foi ativado.'));
      return;
    }
    marcarTotpPendente(false);
    aoMensagem('Autenticador ativado.');
  }

  async function confirmarPasso() {
    const resposta = await chamar('/v1/auth/step-up', { codigoTotp: codigo });
    aoMensagem(
      resposta?.ok
        ? 'Passo extra confirmado por cinco minutos.'
        : textoDe(resposta?.json, 'Código não aceito.'),
    );
  }

  async function sair() {
    let aviso = '';
    try {
      const resposta = await fetchComAcordar(
        urlDaApi('/v1/auth/sair'),
        { method: 'POST', headers: cabecalhosDaSessao() },
        aoMensagem,
      );
      if (!resposta.ok) aviso = ' O servidor pode ainda guardar a sessão.';
    } catch {
      aviso = ' Sem rede, o servidor pode ainda guardar a sessão.';
    }
    limparSessao();
    aoSair();
    aoMensagem(`Sessão encerrada neste aparelho.${aviso}`);
  }

  async function trocarSenha(evento: FormEvent) {
    evento.preventDefault();
    const resposta = await chamar('/v1/auth/senha', { senhaAtual, senhaNova });
    if (!resposta?.ok) {
      aoMensagem(textoDe(resposta?.json, 'A senha não mudou.'));
      return;
    }
    setSenhaAtual('');
    setSenhaNova('');
    aoMensagem('Senha trocada. As outras sessões foram encerradas.');
  }

  return (
    <div className="flex flex-col gap-3">
      {pendente ? (
        <p className="text-base">
          O administrador precisa inscrever o autenticador antes de usar o restante.
        </p>
      ) : null}
      <button
        type="button"
        className="min-h-12 rounded-lg border border-stone-900 px-4"
        onClick={() => void inscrever()}
      >
        Inscrever autenticador
      </button>
      <button
        type="button"
        className="min-h-12 rounded-lg border border-stone-900 px-4"
        onClick={() => void ativar()}
      >
        Ativar autenticador
      </button>
      <button
        type="button"
        className="min-h-12 rounded-lg border border-stone-900 px-4"
        onClick={() => void confirmarPasso()}
      >
        Confirmar passo extra
      </button>
      <form className="flex flex-col gap-2" onSubmit={(evento) => void trocarSenha(evento)}>
        <label className="flex flex-col gap-1 text-base">
          Senha atual
          <input
            className="min-h-12 rounded border border-stone-400 px-3"
            type="password"
            autoComplete="current-password"
            value={senhaAtual}
            onChange={(evento) => setSenhaAtual(evento.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-base">
          Senha nova
          <input
            className="min-h-12 rounded border border-stone-400 px-3"
            type="password"
            autoComplete="new-password"
            value={senhaNova}
            onChange={(evento) => setSenhaNova(evento.target.value)}
          />
        </label>
        <button type="submit" className="min-h-12 rounded-lg border border-stone-900 px-4">
          Trocar senha
        </button>
      </form>
      <button
        type="button"
        className="min-h-12 rounded-lg border border-stone-900 px-4"
        onClick={() => void sair()}
      >
        Sair
      </button>
    </div>
  );
}

async function chamar(
  caminho: string,
  corpo: unknown,
): Promise<{ ok: boolean; json: RespostaJson } | null> {
  try {
    const resposta = await fetchComAcordar(urlDaApi(caminho), {
      method: 'POST',
      headers: cabecalhosDaSessao(),
      body: JSON.stringify(corpo),
    });
    const json = (await resposta.json()) as RespostaJson;
    return { ok: resposta.ok, json };
  } catch {
    return null;
  }
}

function textoDe(json: RespostaJson | undefined, reserva: string): string {
  return json?.erros?.[0]?.mensagem ?? json?.mensagem ?? reserva;
}
