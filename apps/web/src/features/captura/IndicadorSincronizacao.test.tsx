import { render, screen } from '@testing-library/react';
import type { EstadoSync } from '@/lib/offline/tipos';
import { IndicadorSincronizacao } from './IndicadorSincronizacao';

const TEXTOS: [EstadoSync, string][] = [
  ['local', 'Salvo neste aparelho'],
  ['enviando', 'Enviando…'],
  ['sincronizado', 'Sincronizado'],
  ['preso', 'Preso na fila'],
  ['conflito', 'Conflito: escolha o valor'],
];

describe('indicador de sincronização', () => {
  it.each(TEXTOS)('estado %s mostra %s e não um salvo genérico', (estado, texto) => {
    render(<IndicadorSincronizacao estado={estado} />);
    const status = screen.getByRole('status');
    expect(status.textContent).toContain(texto);
    const resto = status.textContent?.split(texto).join('') ?? '';
    expect(resto).not.toMatch(/salvo/i);
  });
});
