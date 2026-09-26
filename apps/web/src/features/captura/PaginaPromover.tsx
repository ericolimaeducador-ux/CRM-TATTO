import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { cabecalhosDaSessao } from '@/lib/offline/sessao';

interface ContatoLido {
  nome?: string;
  status?: string;
}

export function PaginaPromover() {
  const { id = '' } = useParams();
  const [contato, setContato] = useState<ContatoLido | null>(null);
  const [codigo, setCodigo] = useState('');
  const [segredo, setSegredo] = useState('');
  const [mensagem, setMensagem] = useState('');

  useEffect(() => {
    void ler(id).then(setContato);
  }, [id]);

  const nome = contato?.nome || 'este contato';
  const status = contato?.status || 'o status atual';

  return (
    <section className="flex flex-col gap-4">
      <Link className="inline-flex min-h-12 items-center text-base underline" to="/contatos">
        Contatos
      </Link>
      <h1 className="text-2xl font-semibold">Promover a cliente</h1>
      <p className="text-base">
        {nome} está em {status}. Confirmar muda o status para cliente. É a única tela com campo
        obrigatório: o código do autenticador. A captura não pede isso, porque 2FA no meio do
        cadastro trava o vendedor.
      </p>
      <p className="text-base">
        Sem sessão de produção o servidor não sabe quem promove. Fora de produção esta tela usa a
        sessão de teste do aparelho.
      </p>
      <button
        type="button"
        className="min-h-12 rounded-lg border border-stone-900 px-4 text-base"
        onClick={() => void inscrever(setSegredo, setMensagem)}
      >
        Inscrever autenticador deste usuário
      </button>
      {segredo ? (
        <p className="text-base">
          Segredo mostrado uma vez. Guarde no autenticador e não cole em arquivo do projeto:{' '}
          {segredo}
        </p>
      ) : null}
      <form
        className="flex flex-col gap-3"
        onSubmit={(evento) => {
          evento.preventDefault();
          void promover(id, codigo, setMensagem);
        }}
      >
        <label className="flex flex-col gap-1 text-base" htmlFor="codigo-totp">
          Código TOTP obrigatório nesta tela
          <input
            id="codigo-totp"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            className="min-h-12 rounded border border-stone-300 px-3 text-base"
            value={codigo}
            onChange={(evento) => setCodigo(evento.target.value)}
          />
        </label>
        <button
          type="submit"
          className="min-h-12 rounded-lg bg-stone-900 px-4 text-base text-white"
        >
          Promover {nome} a cliente
        </button>
      </form>
      {mensagem ? <p className="text-base">{mensagem}</p> : null}
    </section>
  );
}

async function ler(id: string): Promise<ContatoLido | null> {
  if (!id) return null;
  const resposta = await fetch(`/v1/contatos/${id}`, { headers: cabecalhosDaSessao() });
  if (!resposta.ok) return null;
  const json = (await resposta.json()) as { dados?: ContatoLido };
  return json.dados ?? null;
}

async function inscrever(
  definirSegredo: (valor: string) => void,
  definirMensagem: (valor: string) => void,
): Promise<void> {
  const resposta = await fetch('/v1/auth/totp/inscrever', {
    method: 'POST',
    headers: cabecalhosDaSessao(),
  });
  const json = (await resposta.json()) as {
    dados?: { segredoBase32?: string };
    erros?: { mensagem: string }[];
    mensagem?: string;
  };
  if (!resposta.ok || !json.dados?.segredoBase32) {
    definirMensagem(json.erros?.[0]?.mensagem ?? json.mensagem ?? 'A inscrição não aconteceu.');
    return;
  }
  definirSegredo(json.dados.segredoBase32);
  definirMensagem('Autenticador inscrito. Use o código de 6 dígitos para promover.');
}

async function promover(
  id: string,
  codigo: string,
  definirMensagem: (valor: string) => void,
): Promise<void> {
  const resposta = await fetch(`/v1/contatos/${id}/transicao`, {
    method: 'POST',
    headers: cabecalhosDaSessao(),
    body: JSON.stringify({ para: 'cliente', codigoTotp: codigo }),
  });
  const json = (await resposta.json()) as {
    dados?: { status?: string };
    erros?: { mensagem: string }[];
    mensagem?: string;
  };
  if (!resposta.ok) {
    definirMensagem(
      json.erros?.[0]?.mensagem ??
        json.mensagem ??
        'A promoção não aconteceu. O status continua o mesmo.',
    );
    return;
  }
  definirMensagem(
    json.dados?.status === 'cliente'
      ? 'O contato agora é cliente.'
      : 'A resposta não confirmou o status cliente.',
  );
}
