import { parsearQr } from './parsear';

describe('parsearQr', () => {
  it('guarda payload vazio sem inventar nome', () => {
    const leitura = parsearQr('   ');
    expect(leitura.reconhecido).toBe(false);
    expect(leitura.formato).toBe('desconhecido');
    expect(leitura.payloadBruto).toBe('   ');
    expect(leitura.nome).toBeUndefined();
  });

  it('lê vCard 3.0 e linha dobrada', () => {
    const leitura = parsearQr(
      'BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Ana Lima\r\nTEL;TYPE=CELL:119888\r\n 87777\r\nEMAIL:ana@exemplo.com\r\nEND:VCARD',
    );
    expect(leitura.formato).toBe('vcard');
    expect(leitura.nome).toBe('Ana Lima');
    expect(leitura.telefone).toBe('11988887777');
    expect(leitura.email).toBe('ana@exemplo.com');
    expect(leitura.reconhecido).toBe(true);
  });

  it('lê vCard 2.1 pelo campo N', () => {
    const leitura = parsearQr('BEGIN:VCARD\nVERSION:2.1\nN:Lima;Ana\nEND:VCARD');
    expect(leitura.nome).toBe('Ana Lima');
  });

  it('lê MeCard, mailto, tel, URL e texto livre', () => {
    expect(parsearQr('MECARD:N:Bia;TEL:11977776666;EMAIL:bia@exemplo.com;;').formato).toBe(
      'mecard',
    );
    expect(parsearQr('mailto:bia@exemplo.com').email).toBe('bia@exemplo.com');
    expect(parsearQr('tel:+5511988887777').telefone).toBe('+5511988887777');
    expect(parsearQr('https://exemplo.com/cartao').observacoes).toBe('https://exemplo.com/cartao');
    const livre = parsearQr('nota solta');
    expect(livre.formato).toBe('texto');
    expect(livre.observacoes).toBe('nota solta');
    expect(livre.payloadBruto).toBe('nota solta');
  });
});
