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

  if (!estado) return null;
  return <IndicadorSincronizacao estado={estado} />;
}
