export const CODIGOS_DUPLICIDADE = ['CPF_DUPLICADO', 'CNPJ_DUPLICADO'] as const;
export type CodigoDuplicidade = (typeof CODIGOS_DUPLICIDADE)[number];

export class ErroNomeado extends Error {
  readonly codigo: CodigoDuplicidade;

  constructor(codigo: CodigoDuplicidade, mensagem: string) {
    super(mensagem);
    this.name = 'ErroNomeado';
    this.codigo = codigo;
  }
}

export class ExclusaoFisicaProibida extends Error {
  constructor() {
    super('Exclusão física de contato é proibida. Descarte com status descartado e motivo.');
    this.name = 'ExclusaoFisicaProibida';
  }
}

export class AuditoriaImutavel extends Error {
  constructor() {
    super('contatos_auditoria é append-only. Atualização e exclusão são proibidas.');
    this.name = 'AuditoriaImutavel';
  }
}

export class AutorObrigatorio extends Error {
  constructor() {
    super('Alteração de contato fora de rascunho exige autor identificado no servidor.');
    this.name = 'AutorObrigatorio';
  }
}
