import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types, type Model } from 'mongoose';
import { RespostaComErro } from '../contatos/erros-http';
import type { Contato } from '../contatos/schemas/contato.schema';
import type { UsuarioSessao } from '../contatos/sessao.middleware';
import { compararContatos, type ContatoComparavel } from './comparar-contatos';

interface DocDedup {
  toObject(): Record<string, unknown>;
  set(caminho: string, valor: unknown): unknown;
  markModified(caminho: string): void;
  unmarkModified(caminho: string): void;
  save(): Promise<unknown>;
  $locals: Record<string, unknown>;
}

@Injectable()
export class DedupService {
  constructor(@InjectModel('Contato') private readonly contatos: Model<Contato>) {}

  async listar(usuario: UsuarioSessao) {
    await this.varrer(usuario);
    const docs = await this.contatos
      .find({ status: { $ne: 'descartado' }, 'duplicataSuspeita.0': { $exists: true } })
      .lean();
    return {
      dados: docs.map((doc) => resumo(doc as Record<string, unknown>)),
      avisos: [],
      erros: [],
    };
  }

  async deUm(id: string, usuario: UsuarioSessao) {
    await this.varrer(usuario);
    if (!Types.ObjectId.isValid(id)) {
      throw new RespostaComErro(
        404,
        'CONTATO_AUSENTE',
        'Não achei esse contato para comparar. Nada foi fundido.',
        null,
      );
    }
    const doc = await this.contatos.findById(id).lean();
    if (!doc) {
      throw new RespostaComErro(
        404,
        'CONTATO_AUSENTE',
        'Não achei esse contato para comparar. Nada foi fundido.',
        null,
      );
    }
    return { dados: resumo(doc as Record<string, unknown>), avisos: [], erros: [] };
  }

  private async varrer(usuario: UsuarioSessao): Promise<void> {
    if (usuario.papel !== 'gestor' && usuario.papel !== 'admin') {
      throw new RespostaComErro(
        403,
        'PAPEL_INSUFICIENTE',
        'A fila de duplicatas é do gestor ou do admin. Nada foi fundido.',
        null,
      );
    }
    const docs = (await this.contatos.find({
      status: { $ne: 'descartado' },
    })) as unknown as DocDedup[];
    const planos = docs.map((doc) => doc.toObject());
    for (const doc of docs) {
      const atual = doc.toObject();
      const suspeitas: Record<string, unknown>[] = [];
      const relacionados: Record<string, unknown>[] = [];
      for (const outro of planos) {
        if (String(outro._id) === String(atual._id)) continue;
        const comparacao = compararContatos(atual as ContatoComparavel, outro as ContatoComparavel);
        if (!comparacao) continue;
        if (comparacao.duplicata) {
          suspeitas.push({
            contatoId: outro._id,
            motivo: comparacao.duplicata.motivo,
            similaridade: comparacao.duplicata.similaridade,
            detectadoEm: new Date(),
            resolvido: false,
          });
        }
        if (comparacao.relacionado) {
          relacionados.push({ contatoId: outro._id, tipo: comparacao.relacionado });
        }
      }
      if (
        assinatura(suspeitas) === assinatura(lista(atual.duplicataSuspeita)) &&
        assinatura(relacionados) === assinatura(lista(atual.relacionados))
      ) {
        continue;
      }
      doc.set('duplicataSuspeita', suspeitas);
      doc.set('relacionados', relacionados);
      doc.markModified('duplicataSuspeita');
      doc.markModified('relacionados');
      doc.$locals.autorId = new Types.ObjectId(usuario.id);
      doc.$locals.autorNome = usuario.nome;
      for (const campo of ['criadoPor', 'criadoEm', 'alteradoPor', 'alteradoEm']) {
        doc.unmarkModified(campo);
      }
      await doc.save();
    }
  }
}

function resumo(doc: Record<string, unknown>) {
  return {
    _id: doc._id,
    nome: doc.nome,
    status: doc.status,
    duplicataSuspeita: doc.duplicataSuspeita ?? [],
    relacionados: doc.relacionados ?? [],
  };
}

function lista(valor: unknown): Record<string, unknown>[] {
  return Array.isArray(valor) ? (valor as Record<string, unknown>[]) : [];
}

function assinatura(itens: Record<string, unknown>[]): string {
  return JSON.stringify(
    itens
      .map((item) => ({
        id: String(item.contatoId),
        motivo: item.motivo ?? '',
        similaridade: item.similaridade ?? null,
        tipo: item.tipo ?? '',
      }))
      .sort((a, b) => `${a.id}${a.motivo}${a.tipo}`.localeCompare(`${b.id}${b.motivo}${b.tipo}`)),
  );
}
