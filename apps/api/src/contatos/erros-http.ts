import type { Aviso } from '../normalizacao/avisos';

export class RespostaComErro extends Error {
  readonly statusHttp: number;
  readonly codigo: string;
  readonly avisos: Aviso[];
  readonly dados: unknown;

  constructor(
    statusHttp: number,
    codigo: string,
    mensagem: string,
    dados: unknown,
    avisos: Aviso[] = [],
  ) {
    super(mensagem);
    this.name = 'RespostaComErro';
    this.statusHttp = statusHttp;
    this.codigo = codigo;
    this.dados = dados;
    this.avisos = avisos;
  }
}
