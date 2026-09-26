import { chavesPedidosPublicos, classificarPedido, zerarPedidosPublicos } from './pedidos-publicos';
import { limiteDeUsosDoToken, prazoTokenSegundos } from './prazo-token';
import { saltosDeProxyConfiavel } from './proxy-confiavel';

describe('limite público e prazo do QR', () => {
  const chaves = ['QR_TOKEN_TTL_SEGUNDOS', 'QR_TOKEN_MAX_USOS', 'CAPTURA7_TRUST_PROXY_SALTOS'];
  const ambiente = Object.fromEntries(chaves.map((nome) => [nome, process.env[nome]]));

  afterEach(() => {
    for (const nome of chaves) {
      const valor = ambiente[nome];
      if (valor === undefined) delete process.env[nome];
      else process.env[nome] = valor;
    }
    zerarPedidosPublicos();
  });

  it('apaga o IP quando a janela de um minuto passa', () => {
    classificarPedido('203.0.113.10', 0);
    classificarPedido('203.0.113.11', 0);
    classificarPedido('203.0.113.12', 70_000);
    expect(chavesPedidosPublicos()).toEqual(['203.0.113.12']);
  });

  it('usa duas horas e um uso, e recusa true no proxy', () => {
    delete process.env.QR_TOKEN_TTL_SEGUNDOS;
    delete process.env.QR_TOKEN_MAX_USOS;
    delete process.env.CAPTURA7_TRUST_PROXY_SALTOS;
    expect(prazoTokenSegundos()).toBe(2 * 60 * 60);
    expect(limiteDeUsosDoToken()).toBe(1);
    expect(saltosDeProxyConfiavel()).toBeNull();
    expect(() => saltosDeProxyConfiavel('true')).toThrow(/true não é aceito/);
    expect(saltosDeProxyConfiavel('1')).toBe(1);
  });
});
