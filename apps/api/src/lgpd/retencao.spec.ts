import { baseLegalPorModo } from './base-legal';
import {
  CAMPOS_PURGADOS_NA_REVOGACAO,
  aplicarGuardaAuditoria,
  contatoComercialLiberado,
  devePurgarContato,
  deveSinalizarRascunho,
  envioErpLiberado,
  exportacaoBloqueada,
  exportacaoDaFinalidadeBloqueada,
  prazoGuardaAuditoriaDias,
} from './retencao';

describe('base legal e retenção', () => {
  it('deriva a base pelo modo e nunca devolve vazio', () => {
    expect(baseLegalPorModo('qr_proprio').baseLegal).toBe('legitimo_interesse');
    expect(baseLegalPorModo('google_forms').baseLegal).toBe('legitimo_interesse');
    expect(baseLegalPorModo('qr_lido').baseLegal).toBe('legitimo_interesse');
    expect(baseLegalPorModo('manual').finalidade).toEqual(['prospecção comercial B2B']);
    expect(baseLegalPorModo(undefined).canalColeta).toBe('manual');
  });

  it('bloqueia exportação na revogação e purga só contato depois de 30 dias', () => {
    const revogadoEm = new Date('2026-01-01T00:00:00.000Z');
    expect(exportacaoBloqueada(revogadoEm)).toBe(true);
    expect(exportacaoBloqueada(null)).toBe(false);
    expect(contatoComercialLiberado({ contatoComercial: 'pendente' })).toBe(false);
    expect(contatoComercialLiberado({ contatoComercial: 'concedido' })).toBe(true);
    expect(contatoComercialLiberado({ contatoComercial: 'concedido', revogadoEm })).toBe(false);
    expect(envioErpLiberado(undefined)).toBe(false);
    expect(envioErpLiberado({ consentimentos: [{ finalidade: 'envio_erp' }] })).toBe(true);
    expect(
      exportacaoDaFinalidadeBloqueada({ contatoComercial: 'pendente' }, 'contato_comercial'),
    ).toBe(true);
    delete process.env.AUDITORIA_PRAZO_GUARDA_DIAS;
    expect(prazoGuardaAuditoriaDias()).toBeNull();
    expect(aplicarGuardaAuditoria()).toEqual({ apagadas: 0, motivo: 'prazo_ausente' });
    process.env.AUDITORIA_PRAZO_GUARDA_DIAS = '365';
    expect(prazoGuardaAuditoriaDias()).toBe(365);
    expect(aplicarGuardaAuditoria()).toEqual({ apagadas: 0, motivo: 'trilha_imutavel' });
    delete process.env.AUDITORIA_PRAZO_GUARDA_DIAS;
    expect(devePurgarContato(revogadoEm, new Date('2026-01-30T00:00:00.000Z'))).toBe(false);
    expect(devePurgarContato(revogadoEm, new Date('2026-01-31T00:00:00.000Z'))).toBe(true);
    expect(CAMPOS_PURGADOS_NA_REVOGACAO).toEqual(['emails', 'telefones', 'enderecos']);
  });

  it('sinaliza rascunho parado há 180 dias', () => {
    const alteradoEm = new Date('2026-01-01T00:00:00.000Z');
    expect(
      deveSinalizarRascunho('rascunho', alteradoEm, new Date('2026-06-29T00:00:00.000Z')),
    ).toBe(false);
    expect(
      deveSinalizarRascunho('rascunho', alteradoEm, new Date('2026-06-30T00:00:00.000Z')),
    ).toBe(true);
    expect(
      deveSinalizarRascunho('capturado', alteradoEm, new Date('2027-01-01T00:00:00.000Z')),
    ).toBe(false);
  });
});
