export interface ConfigWhatsApp {
  ativo: boolean;
  completo: boolean;
  versao: string;
  numeroId: string;
  token: string;
  template: string;
  idioma: string;
  appSecret: string;
  verifyToken: string;
}

export function configWhatsApp(): ConfigWhatsApp {
  const valor = (nome: string) => process.env[nome]?.trim() ?? '';
  const versao = valor('WHATSAPP_API_VERSAO');
  const numeroId = valor('WHATSAPP_PHONE_NUMBER_ID');
  const token = valor('WHATSAPP_ACCESS_TOKEN');
  const template = valor('WHATSAPP_TEMPLATE_BOAS_VINDAS');
  const idioma = valor('WHATSAPP_TEMPLATE_IDIOMA') || 'pt_BR';
  const appSecret = valor('WHATSAPP_APP_SECRET');
  const verifyToken = valor('WHATSAPP_VERIFY_TOKEN');
  const completo =
    /^v\d{1,3}\.\d{1,2}$/.test(versao) &&
    /^\d{5,30}$/.test(numeroId) &&
    /^[a-z][a-z0-9_]{0,511}$/.test(template) &&
    /^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(idioma) &&
    [token, appSecret, verifyToken].every(
      (s) => s.length >= 16 && !/preencha|placeholder/i.test(s),
    );
  return {
    ativo: valor('WHATSAPP_ENVIO_ATIVO') === 'true',
    completo,
    versao,
    numeroId,
    token,
    template,
    idioma,
    appSecret,
    verifyToken,
  };
}
