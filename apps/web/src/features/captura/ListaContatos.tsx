import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { lerTodos, observarFila } from '@/lib/offline/fila';
import { podeAuditar, podeGerir } from '@/lib/offline/sessao';
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
      <Link className="atalho" to="/capturar">
        Captura
      </Link>
      <h1 className="text-2xl font-semibold">Contatos</h1>
      {itens.length === 0 ? <p className="text-base">Nenhum contato neste aparelho.</p> : null}
      <ul className="flex flex-col gap-3">
        {itens.map((item) => (
          <li key={item.idLocal} className="cartao">
            <Link className="text-base underline" to={`/contatos/${item.idLocal}`}>
              {rotulo(item)}
            </Link>
            <IndicadorSincronizacao estado={item.estado} />
            {item.idServidor && podeGerir() ? (
              <Link className="mt-2 atalho" to={`/promover/${item.idServidor}`}>
                Promover
              </Link>
            ) : null}
            {item.idServidor && podeAuditar() ? (
              <Link className="mt-2 atalho" to={`/lead/${item.idServidor}`}>
                Abrir lead
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function rotulo(item: ContatoLocal): string {
  const nome = item.campos.nome?.trim();
  return nome || 'Rascunho local';
}
