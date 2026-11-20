import {
  FRASE_ACORDANDO,
  fetchComAcordar,
  marcarServidorAcordando,
  observarAcordar,
} from './acordar';

describe('servidor acordando', () => {
  it('avisa e tenta de novo quando a primeira chamada não responde', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const avisos: string[] = [];
    const resposta = await fetchComAcordar(
      '/v1/saude',
      undefined,
      (texto) => avisos.push(texto),
      0,
    );
    expect(resposta.ok).toBe(true);
    expect(avisos).toContain(FRASE_ACORDANDO);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('repete quando o servidor responde 503', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const resposta = await fetchComAcordar('/v1/saude', undefined, () => undefined, 0);
    expect(resposta.status).toBe(200);
  });

  it('avisa a fila sem segurar a nova tentativa', () => {
    const vistos: string[] = [];
    const parar = observarAcordar((texto) => vistos.push(texto));
    marcarServidorAcordando(true);
    marcarServidorAcordando(false);
    parar();
    expect(vistos).toEqual([FRASE_ACORDANDO, '']);
  });
});
