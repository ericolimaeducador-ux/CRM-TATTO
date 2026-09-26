import { Injectable } from '@nestjs/common';
import { registrarProfundidadeFila } from '../observabilidade/fila-sincronizacao';
import { ContatosService } from './contatos.service';
import type { LoteDto } from './criar-contato.dto';
import { RespostaComErro } from './erros-http';
import type { UsuarioSessao } from './sessao.middleware';

@Injectable()
export class LoteService {
  constructor(private readonly contatos: ContatosService) {}

  async executar(corpo: LoteDto, usuario: UsuarioSessao) {
    if (!Array.isArray(corpo.itens)) {
      throw new RespostaComErro(
        422,
        'LIMITE_LOTE_EXCEDIDO',
        'O lote precisa ser uma lista de contatos. Nada foi gravado. Envie de novo com a lista.',
        null,
      );
    }
    if (typeof corpo.profundidade === 'number') registrarProfundidadeFila(corpo.profundidade);
    if (corpo.itens.length > 100) {
      throw new RespostaComErro(
        422,
        'LIMITE_LOTE_EXCEDIDO',
        'O lote aceita até 100 contatos. Divida a fila e envie de novo. Nada deste lote foi gravado.',
        null,
      );
    }
    const relatorio = [];
    for (const item of corpo.itens) {
      try {
        const resultado = await this.contatos.criar(item, usuario);
        relatorio.push({
          idLocal: resultado.dados.idLocal ?? null,
          http: resultado.http,
          dados: resultado.dados,
          avisos: resultado.avisos,
          erros: [],
        });
      } catch (erro) {
        if (!(erro instanceof RespostaComErro)) throw erro;
        relatorio.push({
          idLocal: item.idLocal ?? null,
          http: erro.statusHttp,
          dados: erro.dados,
          avisos: erro.avisos,
          erros: [{ codigo: erro.codigo, mensagem: erro.message }],
        });
      }
    }
    return { dados: relatorio, avisos: [], erros: [] };
  }
}
