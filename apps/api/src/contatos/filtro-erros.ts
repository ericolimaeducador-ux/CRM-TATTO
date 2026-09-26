import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import type { Response } from 'express';
import { ErroNomeado } from './schemas/erro-nomeado';
import { RespostaComErro } from './erros-http';

@Catch()
export class FiltroErros implements ExceptionFilter {
  catch(excecao: unknown, host: ArgumentsHost): void {
    const resposta = host.switchToHttp().getResponse<Response>();
    if (excecao instanceof RespostaComErro) {
      resposta.status(excecao.statusHttp).json({
        dados: excecao.dados,
        avisos: excecao.avisos,
        erros: [{ codigo: excecao.codigo, mensagem: excecao.message }],
      });
      return;
    }
    if (excecao instanceof ErroNomeado) {
      resposta.status(422).json({
        dados: null,
        avisos: [],
        erros: [{ codigo: excecao.codigo, mensagem: excecao.message }],
      });
      return;
    }
    if (excecao instanceof HttpException) {
      resposta.status(excecao.getStatus()).json(excecao.getResponse());
      return;
    }
    const nome = excecao instanceof Error ? excecao.name : 'Erro';
    console.error(JSON.stringify({ nivel: 'ERROR', evento: 'erro_nao_traduzido', nome }));
    resposta.status(500).json({
      erros: [
        {
          codigo: 'ERRO_INTERNO',
          mensagem:
            'Não consegui concluir agora. Se você estava capturando, o aparelho guarda o rascunho. Tente de novo.',
        },
      ],
    });
  }
}
