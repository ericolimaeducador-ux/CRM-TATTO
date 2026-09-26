import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { urlDaApi } from '@/lib/api-url';
import { textoDaResposta } from '@/lib/texto-resposta';
import { cabecalhosDaSessao, podeGerir } from '@/lib/offline/sessao';

interface Item {
  _id: string;
  nome?: string;
  status?: string;
}

export function PaginaBusca() {
  const [texto, setTexto] = useState('');
  const [itens, setItens] = useState<Item[]>([]);
  const [mensagem, setMensagem] = useState('A busca olha nome, e-mail e telefone. CPF não entra.');

  async function buscar(evento: FormEvent) {
    evento.preventDefault();
    const q = texto.trim();
    if (!q) {
      setItens([]);
      setMensagem('Digite um nome, e-mail ou telefone.');
      return;
    }
    const resposta = await fetch(urlDaApi(`/v1/contatos?q=${encodeURIComponent(q)}`), {
      headers: cabecalhosDaSessao(),
    });
    const json = (await resposta.json()) as {
      dados?: Item[];
      erros?: { mensagem?: string }[];
      mensagem?: string;
    };
    if (!resposta.ok) {
      setMensagem(textoDaResposta(json, 'A busca não saiu. Entre de novo.'));
      return;
    }
    setItens(json.dados ?? []);
    setMensagem(
      json.dados?.length ? 'Resultados neste servidor.' : 'Nenhum contato com esse texto.',
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Busca</h1>
      <form className="flex flex-col gap-3" onSubmit={(evento) => void buscar(evento)}>
        <label className="flex flex-col gap-1 text-base">
          Nome, e-mail ou telefone
          <input
            className="min-h-12 rounded border border-stone-300 px-3"
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
          />
        </label>
        <button
          type="submit"
          className="min-h-12 rounded-lg bg-stone-900 px-4 text-base text-white"
        >
          Buscar no servidor
        </button>
      </form>
      <p className="text-base">{mensagem}</p>
      <ul className="flex flex-col gap-3">
        {itens.map((item) => (
          <li key={item._id} className="rounded border border-stone-300 p-3">
            <p className="text-base">
              {item.nome?.trim() || 'Contato sem nome informado'} · {item.status ?? 'sem status'}
            </p>
            <Link
              className="inline-flex min-h-12 items-center text-base underline"
              to={`/lead/${item._id}`}
            >
              Abrir lead
            </Link>
            {podeGerir() ? (
              <Link
                className="ml-4 inline-flex min-h-12 items-center text-base underline"
                to={`/promover/${item._id}`}
              >
                Promover
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
