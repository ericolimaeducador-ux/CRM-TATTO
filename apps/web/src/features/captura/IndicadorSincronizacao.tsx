import type { EstadoSync } from '@/lib/offline/tipos';

const TEXTOS: Record<EstadoSync, string> = {
  local: 'Salvo neste aparelho',
  enviando: 'Enviando…',
  sincronizado: 'Sincronizado',
  preso: 'Preso na fila',
  conflito: 'Conflito: escolha o valor',
};

const ICONES: Record<EstadoSync, string> = {
  local: 'Celular',
  enviando: 'Enviando',
  sincronizado: 'Nuvem',
  preso: 'Atenção',
  conflito: 'Atenção',
};

export function IndicadorSincronizacao({ estado }: { estado: EstadoSync }) {
  return (
    <p
      role="status"
      data-estado={estado}
      className="flex min-h-12 items-center gap-2 text-base text-stone-900"
    >
      <span
        aria-hidden="true"
        className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-full bg-stone-200 text-xs"
      >
        {ICONES[estado]}
      </span>
      {TEXTOS[estado]}
    </p>
  );
}
