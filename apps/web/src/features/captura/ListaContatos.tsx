import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { lerTodos, observarFila } from '@/lib/offline/fila';
import type { ContatoLocal } from '@/lib/offline/tipos';
import { IndicadorSincronizacao } from './IndicadorSincronizacao';

export function ListaContatos() {
  const [itens, setItens] = useState<ContatoLocal[]>([]);

  useEffect(() => {
    const atualizar = () => {
      void lerTodos()
        .then(setItens)
        .catch(() => setItens([]));
    };
    atualizar();
    return observarFila(atualizar);
  }, []);

  return (
    <section className="flex flex-col gap-4">
      <Link className="inline-flex min-h-12 items-center text-base underline" to="/capturar">
        Captura
      </Link>
      <h1 className="text-2xl font-semibold">Contatos</h1>
      {itens.length === 0 ? <p className="text-base">Nenhum contato neste aparelho.</p> : null}
      <ul className="flex flex-col gap-3">
        {itens.map((item) => (
          <li key={item.idLocal} className="rounded border border-stone-300 p-3">
            <Link className="text-base underline" to={`/contatos/${item.idLocal}`}>
              {item.campos.nome || 'Sem nome'}
            </Link>
            <IndicadorSincronizacao estado={item.estado} />
          </li>
        ))}
      </ul>
    </section>
  );
}
