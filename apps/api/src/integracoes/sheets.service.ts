import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types, type Model } from 'mongoose';
import { ContatosService } from '../contatos/contatos.service';
import { RespostaComErro } from '../contatos/erros-http';
import type { UsuarioSessao } from '../contatos/sessao.middleware';
import { aviso, type Aviso } from '../normalizacao/avisos';
import { ClienteHttp } from './cliente-http';
import { circuitoAberto, registrarResultado } from './circuito';
import { duplicataDeCampos } from '../importacao/duplicata';
import { contatoDaLinha, lerPlanilha } from './planilha-linha';

const INTERVALO_MS = 5 * 60 * 1000;
const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';

interface Marca {
  planilhaId: string;
  ultimaLinha: number;
  em: Date;
}

interface LinhaGravada {
  hash: string;
  linha: number;
  em: Date;
}

export interface ResultadoPlanilha {
  dados: { importados: number; ultimaLinha: number };
  avisos: Aviso[];
  erros: [];
}

@Injectable()
export class SheetsService implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly contatos: ContatosService,
    private readonly http: ClienteHttp,
    @InjectModel('PlanilhaLinha') private readonly linhas: Model<LinhaGravada>,
    @InjectModel('PlanilhaMarca') private readonly marcas: Model<Marca>,
    @InjectModel('Contato') private readonly modeloContatos: Model<unknown>,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;
    const credencial = credencialPlanilha();
    if (!credencial) return;
    this.timer = setInterval(() => {
      void this.sincronizar(autorDaPlanilha(credencial.responsavel)).catch(() => undefined);
    }, INTERVALO_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async sincronizar(usuario: UsuarioSessao): Promise<ResultadoPlanilha> {
    const credencial = credencialPlanilha();
    if (!credencial) {
      return {
        dados: { importados: 0, ultimaLinha: 0 },
        avisos: [
          aviso(
            'planilha',
            'PLANILHA_NAO_CONFIGURADA',
            'A planilha não está configurada neste ambiente. A captura manual continua. Peça o id da planilha, o token e o responsável.',
          ),
        ],
        erros: [],
      };
    }
    if (circuitoAberto('sheets')) {
      return {
        dados: { importados: 0, ultimaLinha: 0 },
        avisos: [
          aviso(
            'planilha',
            'CIRCUITO_ABERTO',
            'A planilha falhou vezes demais. A próxima leitura espera. Nada da captura manual foi bloqueado.',
          ),
        ],
        erros: [],
      };
    }
    const url = `${SHEETS}/${encodeURIComponent(credencial.planilha)}/values/${encodeURIComponent(credencial.aba)}`;
    try {
      const resposta = await this.http.buscar(url, { Authorization: `Bearer ${credencial.token}` });
      const values = corpoValues(resposta.json);
      if (resposta.status < 200 || resposta.status >= 300 || !values) {
        registrarResultado('sheets', false);
        return this.vazio(
          aviso(
            'planilha',
            'FONTE_INDISPONIVEL',
            'A planilha não devolveu linhas agora. A captura manual continua. A próxima leitura tenta de novo.',
          ),
        );
      }
      registrarResultado('sheets', true);
      return this.ingerir(values, credencial.planilha, usuario);
    } catch {
      registrarResultado('sheets', false);
      return this.vazio(
        aviso(
          'planilha',
          'FONTE_INDISPONIVEL',
          'A planilha não respondeu a tempo. A captura manual continua. A próxima leitura tenta de novo.',
        ),
      );
    }
  }

  private async ingerir(
    values: unknown[],
    planilhaId: string,
    usuario: UsuarioSessao,
  ): Promise<ResultadoPlanilha> {
    const avisos: Aviso[] = [];
    let importados = 0;
    for (const linha of lerPlanilha(values)) {
      const ja = await this.linhas.exists({ hash: linha.hash });
      if (ja) continue;
      const contato = contatoDaLinha(linha);
      if (await duplicataDeCampos(this.modeloContatos, contato)) {
        await this.linhas.updateOne(
          { hash: linha.hash },
          { hash: linha.hash, linha: linha.linha, em: new Date() },
          { upsert: true },
        );
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
        await this.linhas.updateOne(
          { hash: linha.hash },
          { hash: linha.hash, linha: linha.linha, em: new Date() },
          { upsert: true },
        );
        importados += 1;
      } catch (erro) {
        if (erro instanceof RespostaComErro) {
          await this.linhas.updateOne(
            { hash: linha.hash },
            { hash: linha.hash, linha: linha.linha, em: new Date() },
            { upsert: true },
          );
          avisos.push(aviso('planilha', erro.codigo, erro.message));
          continue;
        }
        avisos.push(
          aviso(
            'planilha',
            'LINHA_NAO_GRAVADA',
            'Esta linha não entrou. A próxima leitura tenta de novo. As outras linhas seguem.',
          ),
        );
      }
    }
    const ultimaLinha = Math.max(values.length - 1, 0);
    await this.marcas.updateOne(
      { planilhaId },
      { planilhaId, ultimaLinha, em: new Date() },
      { upsert: true },
    );
    return { dados: { importados, ultimaLinha }, avisos, erros: [] };
  }

  private vazio(item: Aviso): ResultadoPlanilha {
    return { dados: { importados: 0, ultimaLinha: 0 }, avisos: [item], erros: [] };
  }
}

function credencialPlanilha(): {
  planilha: string;
  token: string;
  responsavel: string;
  aba: string;
} | null {
  const planilha = process.env.SHEETS_PLANILHA_ID ?? '';
  const token = process.env.SHEETS_TOKEN ?? '';
  const responsavel = process.env.SHEETS_RESPONSAVEL_ID ?? '';
  const aba = process.env.SHEETS_ABA?.trim() || 'Respostas';
  if (!util(planilha) || !util(token) || !util(responsavel)) return null;
  if (!Types.ObjectId.isValid(responsavel)) return null;
  return { planilha, token, responsavel, aba };
}

function util(valor: string): boolean {
  return valor.trim().length > 0 && !valor.startsWith('preencha-');
}

function autorDaPlanilha(responsavel: string): UsuarioSessao {
  return {
    id: responsavel,
    papel: 'gestor',
    nome: 'Responsável da planilha',
    stepUp: false,
  };
}

function corpoValues(json: unknown): unknown[] | null {
  if (!json || typeof json !== 'object' || !('values' in json)) return null;
  const values = (json as { values?: unknown }).values;
  return Array.isArray(values) ? values : null;
}
