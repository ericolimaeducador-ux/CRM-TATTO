import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { jsonDoContato, lerTodos, observarFila, resolverConflito } from '@/lib/offline/fila';
import type { ContatoLocal } from '@/lib/offline/tipos';
import { IndicadorSincronizacao } from './IndicadorSincronizacao';

export function PaginaFila() {
  const [itens, setItens] = useState<ContatoLocal[]>([]);

  useEffect(() => {
    const atualizar = () => {
      void lerTodos()
        .then((todos) => setItens(todos.filter((item) => item.estado !== 'sincronizado')))
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
      <h1 className="text-2xl font-semibold">Fila</h1>
      {itens.length === 0 ? <p className="text-base">Nada pendente.</p> : null}
      {itens.map((item) => (
        <article key={item.idLocal} className="rounded border border-stone-300 p-3">
          <p className="text-base">{item.campos.nome?.trim() || 'Rascunho local'}</p>
          <IndicadorSincronizacao estado={item.estado} />
          {item.mensagem ? <p className="text-base text-amber-900">{item.mensagem}</p> : null}
          {item.estado === 'preso' ? (
            <>
              <p className="text-base text-amber-900">Este registro está preso na fila.</p>
              <button
                type="button"
                className="min-h-12 rounded-lg bg-stone-900 px-4 text-base text-white"
                onClick={() => void exportar(item.idLocal)}
              >
                Exportar este registro como JSON
              </button>
            </>
          ) : null}
          {item.estado === 'conflito' && item.conflito ? (
            <div className="mt-2 flex flex-col gap-2">
              <p className="text-base">
                O campo {item.conflito.campo} diverge. No aparelho: {item.conflito.valorLocal}. No
                servidor: {String(item.conflito.valorServidor[item.conflito.campo] ?? '')}. Escolha
                qual fica. Nada foi fundido sozinho.
              </p>
              <button
                type="button"
                className="min-h-12 rounded-lg bg-stone-900 px-4 text-base text-white"
                onClick={() => void resolverConflito(item.idLocal, true)}
              >
                Ficar com o que digitei
              </button>
              <button
                type="button"
                className="min-h-12 rounded-lg border border-stone-900 px-4 text-base"
                onClick={() => void resolverConflito(item.idLocal, false)}
              >
                Ficar com o do servidor
              </button>
            </div>
          ) : null}
        </article>
      ))}
    </section>
  );
}

async function exportar(idLocal: string): Promise<void> {
  const json = await jsonDoContato(idLocal);
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `contato-${idLocal}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
