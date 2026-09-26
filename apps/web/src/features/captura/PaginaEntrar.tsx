import { FormEvent, useState } from 'react';
import { cabecalhosDaSessao, guardarToken, tokenDaSessao } from '@/lib/offline/sessao';

interface RespostaJson {
  mensagem?: string;
  erros?: { mensagem?: string }[];
  dados?: {
    token?: string;
    usuario?: { nome?: string };
    segredoBase32?: string;
    stepUpAte?: string;
    importados?: number;
    duplicatas?: number;
  };
}

export function PaginaEntrar() {
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [codigo, setCodigo] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [token, setToken] = useState(tokenDaSessao);
  const [segredo, setSegredo] = useState('');
  const [planilha, setPlanilha] = useState('');

  async function entrar(evento: FormEvent) {
    evento.preventDefault();
    const resposta = await fetch('/v1/auth/entrar', {
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
    setToken(json.dados.token);
    setMensagem(`Entrou como ${json.dados.usuario?.nome ?? login}.`);
  }

  async function inscrever() {
    const resposta = await fetch('/v1/auth/totp/inscrever', {
      method: 'POST',
      headers: cabecalhosDaSessao(),
      body: JSON.stringify({ codigoTotp: codigo || undefined }),
    });
    const json = (await resposta.json()) as RespostaJson;
    if (!resposta.ok || !json.dados?.segredoBase32) {
      setMensagem(textoDe(json, 'O autenticador não foi inscrito.'));
      return;
    }
    setSegredo(json.dados.segredoBase32);
    setMensagem('Guarde este segredo no aplicativo autenticador e confirme o código de 6 dígitos.');
  }

  async function confirmarPasso() {
    const resposta = await fetch('/v1/auth/step-up', {
      method: 'POST',
      headers: cabecalhosDaSessao(),
      body: JSON.stringify({ codigoTotp: codigo }),
    });
    const json = (await resposta.json()) as RespostaJson;
    setMensagem(
      resposta.ok
        ? 'Passo extra confirmado por cinco minutos.'
        : textoDe(json, 'Código não aceito.'),
    );
  }

  async function baixar(formato: 'csv' | 'xlsx') {
    const resposta = await fetch(`/v1/exportacoes?formato=${formato}`, {
      headers: cabecalhosDaSessao(),
    });
    if (!resposta.ok) {
      const json = (await resposta.json()) as RespostaJson;
      setMensagem(textoDe(json, 'A exportação não saiu. Confirme o código do autenticador.'));
      return;
    }
    const blob = await resposta.blob();
    const url = URL.createObjectURL(blob);
    const ancora = document.createElement('a');
    ancora.href = url;
    ancora.download = `captura7-leads.${formato}`;
    ancora.click();
    URL.revokeObjectURL(url);
    setMensagem(`Arquivo ${formato.toUpperCase()} baixado.`);
  }

  async function importar(evento: FormEvent) {
    evento.preventDefault();
    const resposta = await fetch('/v1/importacoes', {
      method: 'POST',
      headers: cabecalhosDaSessao(),
      body: JSON.stringify({ texto: planilha }),
    });
    const json = (await resposta.json()) as RespostaJson;
    if (!resposta.ok) {
      setMensagem(textoDe(json, 'A planilha não entrou.'));
      return;
    }
    setMensagem(
      `Importação pronta. Novos: ${json.dados?.importados ?? 0}. Repetidos: ${json.dados?.duplicatas ?? 0}.`,
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Entrar</h1>
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
          Código do autenticador
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
          className="min-h-12 rounded-lg bg-stone-900 px-4 text-base text-white"
        >
          Entrar
        </button>
      </form>
      {token ? (
        <div className="flex flex-col gap-3">
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
          <button
            type="button"
            className="min-h-12 rounded-lg border border-stone-900 px-4"
            onClick={() => void baixar('csv')}
          >
            Baixar CSV
          </button>
          <button
            type="button"
            className="min-h-12 rounded-lg border border-stone-900 px-4"
            onClick={() => void baixar('xlsx')}
          >
            Baixar XLSX
          </button>
          <form className="flex flex-col gap-2" onSubmit={(evento) => void importar(evento)}>
            <label className="flex flex-col gap-1 text-base">
              Planilha CSV do Google
              <textarea
                className="min-h-24 rounded border border-stone-400 px-3 py-2"
                value={planilha}
                onChange={(evento) => setPlanilha(evento.target.value)}
              />
            </label>
            <button type="submit" className="min-h-12 rounded-lg border border-stone-900 px-4">
              Importar planilha
            </button>
          </form>
        </div>
      ) : null}
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
