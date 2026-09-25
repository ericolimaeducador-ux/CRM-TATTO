import { contatoSchema } from '../contatos/schemas/contato.schema';
import { aplicarSegurancaNoSchema } from './aplicar-no-schema';

export function registrar(): void {
  aplicarSegurancaNoSchema(contatoSchema);
}
