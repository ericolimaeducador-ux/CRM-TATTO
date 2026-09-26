export interface RespostaExterna {
  status: number;
  json: unknown;
}

export async function buscarJson(
  url: string,
  opcoes: {
    headers?: Record<string, string>;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
  } = {},
): Promise<RespostaExterna> {
  const fetchImpl = opcoes.fetchImpl ?? fetch;
  const resposta = await fetchImpl(url, {
    headers: opcoes.headers,
    signal: AbortSignal.timeout(opcoes.timeoutMs ?? 3000),
  });
  let json: unknown = null;
  try {
    json = await resposta.json();
  } catch {
    json = null;
  }
  return { status: resposta.status, json };
}
