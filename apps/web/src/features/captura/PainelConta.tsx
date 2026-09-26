import { FormEvent, useState } from 'react';
import { urlDaApi } from '@/lib/api-url';
import { cabecalhosDaSessao, limparSessao, marcarTotpPendente } from '@/lib/offline/sessao';

interface RespostaJson {
  mensagem?: string;
  erros?: { mensagem?: string }[];
  dados?: { segredoBase32?: string };
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
    const resposta = await fetch(urlDaApi('/v1/auth/totp/inscrever'), {
      method: 'POST',
      headers: cabecalhosDaSessao(),
      body: JSON.stringify({ codigoTotp: codigo || undefined }),
    });
    const json = (await resposta.json()) as RespostaJson;
    if (!resposta.ok || !json.dados?.segredoBase32) {
      aoMensagem(textoDe(json, 'O autenticador não foi inscrito.'));
      return;
    }
    marcarTotpPendente(false);
    aoSegredo(json.dados.segredoBase32);
    aoMensagem('Guarde este segredo no aplicativo autenticador e confirme o código de 6 dígitos.');
  }

  async function confirmarPasso() {
    const resposta = await fetch(urlDaApi('/v1/auth/step-up'), {
      method: 'POST',
      headers: cabecalhosDaSessao(),
      body: JSON.stringify({ codigoTotp: codigo }),
    });
    const json = (await resposta.json()) as RespostaJson;
    aoMensagem(
      resposta.ok
        ? 'Passo extra confirmado por cinco minutos.'
        : textoDe(json, 'Código não aceito.'),
    );
  }

  async function sair() {
    await fetch(urlDaApi('/v1/auth/sair'), { method: 'POST', headers: cabecalhosDaSessao() });
    limparSessao();
    aoSair();
    aoMensagem('Sessão encerrada neste aparelho e no servidor.');
  }

  async function trocarSenha(evento: FormEvent) {
    evento.preventDefault();
    const resposta = await fetch(urlDaApi('/v1/auth/senha'), {
      method: 'POST',
      headers: cabecalhosDaSessao(),
      body: JSON.stringify({ senhaAtual, senhaNova }),
    });
    const json = (await resposta.json()) as RespostaJson;
    aoMensagem(resposta.ok ? 'Senha trocada.' : textoDe(json, 'A senha não mudou.'));
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

function textoDe(json: RespostaJson, reserva: string): string {
  return json.erros?.[0]?.mensagem ?? json.mensagem ?? reserva;
}
