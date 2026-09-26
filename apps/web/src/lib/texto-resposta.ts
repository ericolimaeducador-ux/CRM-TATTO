export function textoDaResposta(
  json: { erros?: { mensagem?: string }[]; mensagem?: string },
  reserva: string,
): string {
  return json.erros?.[0]?.mensagem ?? json.mensagem ?? reserva;
}
