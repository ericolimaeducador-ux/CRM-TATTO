import { calcularCompletude, enderecoCompleto, PESOS_COMPLETUDE } from './completude';
import { TABELA_COMPLETUDE } from './completude.tabela';

describe('tabela de completude', () => {
  it.each(TABELA_COMPLETUDE)('$nome soma $esperado.score', (linha) => {
    const resultado = calcularCompletude(linha.entrada);
    expect(resultado.score).toBe(linha.esperado.score);
    expect(resultado.status).toBe(linha.esperado.status);
  });

  it('não promove de novo quem já saiu de rascunho', () => {
    const resultado = calcularCompletude({ nome: 'Ana', telefone: true, status: 'qualificado' });
    expect(resultado.score).toBe(35);
    expect(resultado.status).toBe('qualificado');
  });

  it('endereço completo exige logradouro, número, cidade e UF', () => {
    expect(enderecoCompleto({ logradouro: 'Rua A', numero: '1', cidade: 'SP', uf: 'SP' })).toBe(
      true,
    );
    expect(enderecoCompleto({ logradouro: 'Rua A', cidade: 'SP', uf: 'SP' })).toBe(false);
  });

  it('soma dos pesos cabe em 100', () => {
    expect(Object.values(PESOS_COMPLETUDE).reduce((acc, peso) => acc + peso, 0)).toBe(100);
    expect(TABELA_COMPLETUDE).toHaveLength(12);
  });
});
