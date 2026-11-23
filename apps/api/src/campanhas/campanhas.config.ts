export function configCampanhas() {
  const valor = (nome: string) => process.env[nome]?.trim() ?? '';
  const campos = {
    WHATSAPP_API_VERSAO: /^v\d{1,3}\.\d{1,2}$/.test(valor('WHATSAPP_API_VERSAO')),
    WHATSAPP_PHONE_NUMBER_ID: /^\d{5,30}$/.test(valor('WHATSAPP_PHONE_NUMBER_ID')),
    WHATSAPP_WABA_ID: /^\d{5,30}$/.test(valor('WHATSAPP_WABA_ID')),
    WHATSAPP_ACCESS_TOKEN: valido(valor('WHATSAPP_ACCESS_TOKEN')),
    WHATSAPP_APP_SECRET: valido(valor('WHATSAPP_APP_SECRET')),
    WHATSAPP_VERIFY_TOKEN: valido(valor('WHATSAPP_VERIFY_TOKEN')),
  };
  const faltantes = Object.entries(campos)
    .filter(([, ok]) => !ok)
    .map(([nome]) => nome);
  return {
    ativo: valor('CAMPANHAS_WHATSAPP_ATIVO') === 'true',
    completo: faltantes.length === 0,
    faltantes,
    versao: valor('WHATSAPP_API_VERSAO'),
    numeroId: valor('WHATSAPP_PHONE_NUMBER_ID'),
    wabaId: valor('WHATSAPP_WABA_ID'),
    token: valor('WHATSAPP_ACCESS_TOKEN'),
  };
}
function valido(texto: string) {
  return texto.length >= 16 && !/preencha|placeholder/i.test(texto);
}
