import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { RespostaComErro } from '../contatos/erros-http';
import type { UsuarioSessao } from '../contatos/sessao.middleware';
import { paraCsv, paraXlsx } from './tabela';

const COLUNAS = [
  'nome',
  'email',
  'telefone',
  'status',
  'origem',
  'baseLegal',
  'contatoComercial',
  'criadoEm',
] as const;

interface ContatoExportavel {
  nome?: string;
  status?: string;
  criadoEm?: Date;
  emails?: { valor?: string }[];
  telefones?: { e164?: string; bruto?: string }[];
  origem?: { modo?: string };
  lgpd?: { baseLegal?: string; contatoComercial?: string; eliminadoEm?: Date | null };
}

interface LinhaAuditoria {
  autorId: string;
  papel: string;
  formato: string;
  filtros: { status?: string; origem?: string };
  quantidade: number;
  em: Date;
}

@Injectable()
export class ExportacaoService {
  constructor(
    @InjectModel('Contato') private readonly contatos: Model<ContatoExportavel>,
    @InjectModel('ExportacaoAuditoria') private readonly trilha: Model<LinhaAuditoria>,
  ) {}

  async gerar(
    formatoBruto: string | undefined,
    status: string | undefined,
    origem: string | undefined,
    usuario: UsuarioSessao,
  ) {
    const formato = formatoBruto === 'xlsx' ? 'xlsx' : formatoBruto === 'csv' ? 'csv' : '';
    if (!formato) {
      throw new RespostaComErro(
        422,
        'FORMATO_INVALIDO',
        'Informe formato=csv ou formato=xlsx. Nada foi exportado.',
        null,
      );
    }
    const filtros = {
      ...(status ? { status } : {}),
      ...(origem ? { 'origem.modo': origem } : {}),
      'lgpd.eliminadoEm': null,
      'lgpd.contatoComercial': 'concedido',
    };
    const itens = await this.contatos.find(filtros).sort({ criadoEm: 1 }).limit(5000).lean();
    const linhas = [COLUNAS.slice(), ...itens.map(linhaDe)];
    const corpo = formato === 'csv' ? Buffer.from(paraCsv(linhas), 'utf8') : paraXlsx(linhas);
    const em = new Date();
    await this.trilha.create({
      autorId: usuario.id,
      papel: usuario.papel,
      formato,
      filtros: { status: status ?? '', origem: origem ?? '' },
      quantidade: itens.length,
      em,
    });
    const dia = em.toISOString().slice(0, 10);
    return {
      corpo,
      tipo:
        formato === 'csv'
          ? 'text/csv; charset=utf-8'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      nome: `tattooart-leads-${dia}.${formato}`,
    };
  }
}

function linhaDe(item: ContatoExportavel): string[] {
  return [
    item.nome ?? '',
    item.emails?.[0]?.valor ?? '',
    item.telefones?.[0]?.e164 || item.telefones?.[0]?.bruto || '',
    item.status ?? '',
    item.origem?.modo ?? '',
    item.lgpd?.baseLegal ?? '',
    item.lgpd?.contatoComercial ?? '',
    item.criadoEm ? new Date(item.criadoEm).toISOString() : '',
  ];
}
