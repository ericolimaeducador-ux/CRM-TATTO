import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { urlDaApi } from '@/lib/api-url';
import { cabecalhosDaSessao } from '@/lib/offline/sessao';

interface Suspeita {
  contatoId: string;
  motivo: string;
  similaridade: number;
}

interface Item {
  _id: string;
  nome?: string;
  duplicataSuspeita?: Suspeita[];
}

export function PaginaDuplicatas() {
  const [itens, setItens] = useState<Item[]>([]);
  const [mensagem, setMensagem] = useState('Procurando sugestões. Nada é fundido nesta tela.');

  useEffect(() => {
    void fetch(urlDaApi('/v1/duplicatas'), { headers: cabecalhosDaSessao() })
      .then(async (resposta) => {
        const json = (await resposta.json()) as {
          dados?: Item[];
          erros?: { mensagem: string }[];
        };
        if (!resposta.ok) {
          setMensagem(
            json.erros?.[0]?.mensagem ??
              'Só gestor ou admin vê a fila de duplicatas. A captura do vendedor continua.',
          );
          return;
        }
        setItens(json.dados ?? []);
        setMensagem(
          json.dados?.length
            ? 'Cada linha é uma sugestão. A fusão só acontece na tela seguinte, com escolha sua.'
            : 'Nenhuma duplicata sugerida. Matriz e filial não entram nesta fila.',
        );
      })
      .catch(() => {
        setMensagem('Não consegui ler a fila agora. A captura continua e nada foi fundido.');
      });
  }, []);

  return (
    <section className="flex flex-col gap-4">
      <Link className="atalho" to="/capturar">
        Captura
      </Link>
      <h1 className="text-2xl font-semibold">Duplicatas</h1>
      <p className="text-base">{mensagem}</p>
      {itens.map((item) =>
        (item.duplicataSuspeita ?? []).map((suspeita) => (
          <Link
            key={`${item._id}-${suspeita.contatoId}`}
            className="atalho"
            to={`/merge/${item._id}/${suspeita.contatoId}`}
          >
            {item.nome ?? 'Contato sem nome informado'} parece o contato {suspeita.contatoId} (
            {suspeita.motivo}, {suspeita.similaridade})
          </Link>
        )),
      )}
    </section>
  );
}
