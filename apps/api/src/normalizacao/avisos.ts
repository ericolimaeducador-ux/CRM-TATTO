export interface Aviso {
  campo: string;
  codigo: string;
  mensagem: string;
}

export function aviso(campo: string, codigo: string, mensagem: string): Aviso {
  return { campo, codigo, mensagem };
}
