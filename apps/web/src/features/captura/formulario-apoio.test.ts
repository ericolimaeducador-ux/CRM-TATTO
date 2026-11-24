import { describe, expect, it } from 'vitest';
import { mascararTelefone } from './formulario-apoio';

describe('máscara de telefone: DDD + número, sem código do país', () => {
  it('formata celular e fixo digitados com DDD', () => {
    expect(mascararTelefone('11987654321')).toBe('(11) 98765-4321');
    expect(mascararTelefone('1133334444')).toBe('(11) 3333-4444');
  });

  it('descarta +55 e 0 vindos de colagem ou autocompletar', () => {
    expect(mascararTelefone('+55 11 98765-4321')).toBe('(11) 98765-4321');
    expect(mascararTelefone('5511987654321')).toBe('(11) 98765-4321');
    expect(mascararTelefone('011 98765-4321')).toBe('(11) 98765-4321');
  });

  it('mantém o DDD 55 quando o número tem só DDD + celular', () => {
    expect(mascararTelefone('55987654321')).toBe('(55) 98765-4321');
  });
});
