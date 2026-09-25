import { cnpjValido, cpfValido } from './documento';
import {
  normalizarCep,
  normalizarCpf,
  normalizarEmail,
  normalizarNome,
  normalizarTelefone,
} from './normalizar';

describe('normalização sem rejeitar', () => {
  it('aplica title case e preserva preposição', () => {
    expect(normalizarNome('joão da silva e souza')).toBe('João da Silva e Souza');
    expect(normalizarNome('MARIA DAS DORES')).toBe('Maria das Dores');
  });

  it('assume +55 sem DDI e guarda lixo como veio', () => {
    expect(normalizarTelefone('(11) 98765-4321')).toEqual({
      bruto: '(11) 98765-4321',
      e164: '+5511987654321',
    });
    expect(normalizarTelefone('+5511987654321').e164).toBe('+5511987654321');
    const ruim = normalizarTelefone('abc');
    expect(ruim.e164).toBeUndefined();
    expect(ruim.bruto).toBe('abc');
    expect(ruim.aviso?.codigo).toBe('TELEFONE_INVALIDO');
  });

  it('baixa o e-mail válido e preserva o inválido', () => {
    expect(normalizarEmail(' Ana@Exemplo.COM ').valor).toBe('ana@exemplo.com');
    const ruim = normalizarEmail('nao-e-email');
    expect(ruim.valor).toBe('nao-e-email');
    expect(ruim.aviso?.codigo).toBe('EMAIL_INVALIDO');
  });

  it('valida DV e não lança em documento ruim', () => {
    expect(cpfValido('52998224725')).toBe(true);
    expect(normalizarCpf('529.982.247-25')).toMatchObject({ valor: '52998224725', valido: true });
    const ruim = normalizarCpf('111.111.111-11');
    expect(ruim.valido).toBe(false);
    expect(ruim.valor).toBe('111.111.111-11');
    expect(ruim.aviso?.codigo).toBe('CPF_INVALIDO');
    expect(cnpjValido('11.222.333/0001-81')).toBe(true);
  });

  it('exige 8 dígitos no CEP', () => {
    expect(normalizarCep('01310-100').valor).toBe('01310100');
    expect(normalizarCep('123').aviso?.codigo).toBe('CEP_INVALIDO');
    expect(normalizarCep('123').valor).toBe('123');
  });
});
