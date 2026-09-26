import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { ContatosService } from '../contatos/contatos.service';
import { RespostaComErro } from '../contatos/erros-http';
import type { UsuarioSessao } from '../contatos/sessao.middleware';
import { aviso, type Aviso } from '../normalizacao/avisos';
import { contatoDaLinha, lerPlanilha } from '../integracoes/planilha-linha';
import { lerCsv, matrizDoXlsx } from '../exportacao/tabela';
import { duplicataDeCampos } from './duplicata';

@Injectable()
export class ImportacaoService {
  constructor(
    private readonly contatos: ContatosService,
    @InjectModel('Contato') private readonly modelo: Model<unknown>,
  ) {}

  async importar(
    corpo: { texto?: string; xlsxBase64?: string },
    usuario: UsuarioSessao,
  ): Promise<{ dados: { importados: number; duplicatas: number }; avisos: Aviso[]; erros: [] }> {
    const matriz = this.matriz(corpo);
    const avisos: Aviso[] = [];
    let importados = 0;
    let duplicatas = 0;
    for (const linha of lerPlanilha(matriz)) {
      const contato = contatoDaLinha(linha);
      contato.idLocal = `importado-${linha.hash}`;
      if (await duplicataDeCampos(this.modelo, contato)) {
        duplicatas += 1;
        avisos.push(
          aviso(
            'planilha',
            'DUPLICATA',
            'Esta linha repete e-mail ou telefone já gravado. Não foi fundida.',
          ),
        );
        continue;
      }
      try {
        await this.contatos.criar(contato, usuario);
        importados += 1;
      } catch (erro) {
        if (erro instanceof RespostaComErro) {
          avisos.push(aviso('planilha', erro.codigo, erro.message));
          continue;
        }
        avisos.push(
          aviso('planilha', 'LINHA_NAO_GRAVADA', 'Esta linha não entrou. As outras seguem.'),
        );
      }
    }
    return { dados: { importados, duplicatas }, avisos, erros: [] };
  }

  private matriz(corpo: { texto?: string; xlsxBase64?: string }): unknown[] {
    if (corpo.xlsxBase64?.trim()) {
      try {
        return matrizDoXlsx(Buffer.from(corpo.xlsxBase64, 'base64'));
      } catch {
        throw new RespostaComErro(
          422,
          'IMPORTACAO_INVALIDA',
          'Não li o XLSX. Exporte a planilha do Google como CSV e envie o texto. Nada foi gravado.',
          null,
        );
      }
    }
    if (corpo.texto?.trim()) return lerCsv(corpo.texto);
    throw new RespostaComErro(
      422,
      'IMPORTACAO_INVALIDA',
      'Envie o CSV em texto ou o XLSX em base64. Nada foi gravado.',
      null,
    );
  }
}
