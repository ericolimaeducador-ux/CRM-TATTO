import { FormEvent, useState } from 'react';
import { fetchComAcordar } from '@/lib/acordar';
import { urlDaApi } from '@/lib/api-url';
import { cabecalhosDaSessao, limparSessao, marcarTotpPendente } from '@/lib/offline/sessao';
import { InscricaoTotp, type DadosInscricao } from './InscricaoTotp';

interface RespostaJson {
  mensagem?: string;
  erros?: { mensagem?: string }[];
  dados?: { segredoBase32?: string; otpauth?: string; pendente?: boolean };
}

export function PainelConta({
  codigo,
  pendente,
  aoMensagem,
  aoSair,
}: {
  codigo: string;
  pendente: boolean;
  aoMensagem: (texto: string) => void;
  aoSair: () => void;
}) {
  const [senhaAtual, setSenhaAtual] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [inscricao, setInscricao] = useState<DadosInscricao | null>(null);
  const [geracao, setGeracao] = useState(0);

  async function inscrever() {
    const resposta = await chamar('/v1/auth/totp/inscrever', { codigoTotp: codigo || undefined });
    if (!resposta?.ok || !resposta.json.dados?.segredoBase32) {
      aoMensagem(textoDe(resposta?.json, 'O autenticador não foi inscrito.'));
      return;
    }
    setInscricao({
      segredo: resposta.json.dados.segredoBase32,
      otpauth: resposta.json.dados.otpauth ?? '',
    });
    setGeracao((valor) => valor + 1);
    // O bloco com os passos já é a resposta; um aviso flutuante cobriria as instruções.
    aoMensagem('');
  }

  async function ativar(codigoInformado: string) {
    const resposta = await chamar('/v1/auth/totp/ativar', { codigoTotp: codigoInformado });
    if (!resposta?.ok) {
      aoMensagem(textoDe(resposta?.json, 'O autenticador não foi ativado.'));
      return;
    }
    marcarTotpPendente(false);
    setInscricao(null);
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

  const focoNaInscricao = pendente || inscricao !== null;

  return (
    <div className="flex flex-col gap-3">
      {pendente ? (
        <p className="text-base">
          O administrador precisa inscrever o autenticador antes de usar o restante.
        </p>
      ) : null}
      <button
        type="button"
        className={pendente && !inscricao ? 'btn' : 'btn-secundario'}
        onClick={() => void inscrever()}
      >
        Inscrever autenticador
      </button>
      {inscricao ? (
        <InscricaoTotp
          key={geracao}
          dados={inscricao}
          codigoInicial=""
          aoAtivar={(valor) => void ativar(valor)}
        />
      ) : (
        <button type="button" className="btn-secundario" onClick={() => void ativar(codigo)}>
          Ativar autenticador
        </button>
      )}
      {inscricao && !pendente ? (
        <button type="button" className="btn-secundario" onClick={() => setInscricao(null)}>
          Fechar sem ativar
        </button>
      ) : null}
      {focoNaInscricao ? null : (
        <>
          <button type="button" className="btn-secundario" onClick={() => void confirmarPasso()}>
            Confirmar passo extra
          </button>
          <form className="flex flex-col gap-2" onSubmit={(evento) => void trocarSenha(evento)}>
            <label className="flex flex-col gap-1 text-base">
              Senha atual
              <input
                className="campo"
                type="password"
                autoComplete="current-password"
                value={senhaAtual}
                onChange={(evento) => setSenhaAtual(evento.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-base">
              Senha nova
              <input
                className="campo"
                type="password"
                autoComplete="new-password"
                value={senhaNova}
                onChange={(evento) => setSenhaNova(evento.target.value)}
              />
            </label>
            <button type="submit" className="btn-secundario">
              Trocar senha
            </button>
          </form>
        </>
      )}
      <button type="button" className="btn-secundario" onClick={() => void sair()}>
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
