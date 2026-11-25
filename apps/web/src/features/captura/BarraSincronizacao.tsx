import { useEffect, useState } from 'react';
import { lerTodos, observarFila } from '@/lib/offline/fila';
import type { EstadoSync } from '@/lib/offline/tipos';
import { IndicadorSincronizacao } from './IndicadorSincronizacao';

const PRIORIDADE: EstadoSync[] = ['preso', 'conflito', 'enviando', 'local', 'sincronizado'];

export function BarraSincronizacao() {
  const [estado, setEstado] = useState<EstadoSync | null>(null);

  useEffect(() => {
    const atualizar = () => {
      void lerTodos()
        .then((itens) => {
          const pior =
            PRIORIDADE.find((candidato) => itens.some((item) => item.estado === candidato)) ?? null;
          setEstado(pior);
        })
        .catch(() => setEstado(null));
    };
    atualizar();
    return observarFila(atualizar);
  }, []);

  // Tudo sincronizado não precisa ocupar o topo de toda página; só avisa quando há pendência.
  if (!estado || estado === 'sincronizado') return null;
  return <IndicadorSincronizacao estado={estado} />;
}
