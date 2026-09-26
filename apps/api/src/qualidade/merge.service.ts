import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types, type Model } from 'mongoose';
import { RespostaComErro } from '../contatos/erros-http';
import type { Contato } from '../contatos/schemas/contato.schema';
import { STATUS_CONTATO } from '../contatos/schemas/contato.schema';
import type { ContatoAuditoria } from '../contatos/schemas/contato-auditoria.schema';
import type { UsuarioSessao } from '../contatos/sessao.middleware';
import { CAMPOS_MERGE, copiarCampo, prazoExpirado } from './campos-merge';

interface DocMerge {
  toObject(): Record<string, unknown>;
  get(caminho: string): unknown;
  set(caminho: string, valor: unknown): unknown;
  markModified(caminho: string): void;
  unmarkModified(caminho: string): void;
  save(): Promise<unknown>;
  $locals: Record<string, unknown>;
}

const STATUS_RECUPERAVEIS = new Set<string>(
  STATUS_CONTATO.filter((status) => status !== 'descartado'),
);

@Injectable()
export class MergeService {
  constructor(
    @InjectModel('Contato') private readonly contatos: Model<Contato>,
    @InjectModel('ContatoAuditoria') private readonly auditoria: Model<ContatoAuditoria>,
  ) {}

  async fundir(
    vencedorId: string,
    absorvidoId: string | undefined,
    valores: Record<string, string> | undefined,
    confirmacao: boolean | undefined,
    usuario: UsuarioSessao,
  ) {
    if (confirmacao !== true) {
      throw new RespostaComErro(
        422,
        'MERGE_SEM_CONFIRMACAO',
        'A fusão só acontece com a confirmação do resumo: o absorvido será descartado e fica recuperável por 90 dias. Nada foi alterado.',
        null,
      );
    }
    if (!absorvidoId || absorvidoId === vencedorId) {
      throw new RespostaComErro(
        422,
        'MERGE_INVALIDO',
        'Escolha dois contatos diferentes. Nada foi alterado.',
        null,
      );
    }
    const vencedor = await this.exigir(vencedorId);
    const absorvido = await this.exigir(absorvidoId);
    for (const campo of CAMPOS_MERGE) {
      if (valores?.[campo] === 'absorvido') copiarCampo(vencedor, absorvido, campo);
    }
    marcarAutor(vencedor, usuario);
    await vencedor.save();
    const statusAntes = String(absorvido.get('status') ?? 'rascunho');
    absorvido.set('status', 'descartado');
    absorvido.set('fundidoEm', vencedor.get('_id'));
    absorvido.set('motivoDescarte', `Fundido. Status anterior: ${statusAntes}`);
    marcarAutor(absorvido, usuario);
    await absorvido.save();
    return { dados: vencedor.toObject(), avisos: [], erros: [] };
  }

  async recuperar(id: string, usuario: UsuarioSessao, agora = new Date()) {
    const doc = await this.exigir(id);
    if (doc.get('status') !== 'descartado' || !doc.get('fundidoEm')) {
      throw new RespostaComErro(
        422,
        'RECUPERACAO_INDISPONIVEL',
        'Este contato não está fundido. Nada foi alterado.',
        doc.toObject(),
      );
    }
    const trilha = await this.auditoria
      .findOne({ contatoId: doc.get('_id'), campo: 'status', valorNovo: 'descartado' })
      .sort({ timestampServidor: -1 })
      .lean();
    const quando =
      trilha?.timestampServidor ?? (doc.get('alteradoEm') as Date | undefined) ?? agora;
    if (prazoExpirado(new Date(quando), agora)) {
      throw new RespostaComErro(
        422,
        'PRAZO_RECUPERACAO_EXPIRADO',
        'Passaram 90 dias da fusão. Este registro não volta por esta tela. O vencedor continua como está.',
        doc.toObject(),
      );
    }
    const anterior = statusAnterior(trilha?.valorAnterior, String(doc.get('motivoDescarte') ?? ''));
    doc.set('status', anterior);
    doc.set('fundidoEm', undefined);
    doc.set('motivoDescarte', undefined);
    marcarAutor(doc, usuario);
    await doc.save();
    return { dados: doc.toObject(), avisos: [], erros: [] };
  }

  private async exigir(id: string): Promise<DocMerge> {
    if (!Types.ObjectId.isValid(id)) {
      throw new RespostaComErro(
        404,
        'CONTATO_AUSENTE',
        'Não achei esse contato. Nada foi alterado.',
        null,
      );
    }
    const doc = await this.contatos.findById(id);
    if (!doc) {
      throw new RespostaComErro(
        404,
        'CONTATO_AUSENTE',
        'Não achei esse contato. Nada foi alterado.',
        null,
      );
    }
    return doc as unknown as DocMerge;
  }
}

function marcarAutor(doc: DocMerge, usuario: UsuarioSessao): void {
  doc.$locals.autorId = new Types.ObjectId(usuario.id);
  doc.$locals.autorNome = usuario.nome;
  for (const campo of ['criadoPor', 'criadoEm', 'alteradoPor', 'alteradoEm']) {
    doc.unmarkModified(campo);
  }
}

function statusAnterior(valorAuditoria: unknown, motivo: string): string {
  if (typeof valorAuditoria === 'string' && STATUS_RECUPERAVEIS.has(valorAuditoria)) {
    return valorAuditoria;
  }
  const achado = motivo.match(/Status anterior: ([a-z_]+)/);
  if (achado && STATUS_RECUPERAVEIS.has(achado[1])) return achado[1];
  return 'rascunho';
}
