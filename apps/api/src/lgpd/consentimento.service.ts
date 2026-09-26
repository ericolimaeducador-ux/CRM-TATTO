import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types, type Model } from 'mongoose';
import { podeAcessarCarteira } from '../auth/perfil-permissoes';
import { RespostaComErro } from '../contatos/erros-http';
import type { Contato } from '../contatos/schemas/contato.schema';
import type { UsuarioSessao } from '../contatos/sessao.middleware';
import { contatoComercialLiberado, importadoLiberado } from './retencao';
import { textoDoTermo } from './texto-termo';

interface DocMutavel {
  _id: Types.ObjectId;
  get(caminho: string): unknown;
  set(caminho: string, valor: unknown): unknown;
  markModified(caminho: string): void;
  save(): Promise<unknown>;
  toObject(): Record<string, unknown>;
  $locals: { autorId?: Types.ObjectId; autorNome?: string };
}

@Injectable()
export class ConsentimentoService {
  constructor(@InjectModel('Contato') private readonly contatos: Model<Contato>) {}

  async registrar(
    id: string,
    usuario: UsuarioSessao,
    contatoComercial: boolean | undefined,
    emDispositivo: string | undefined,
  ) {
    const doc = await this.exigir(id, usuario);
    if (contatoComercial !== true) {
      return { dados: doc.toObject(), avisos: [], erros: [] };
    }
    gravarConcessao(doc, usuario.id, 'vendedor_evento', emDispositivo);
    await this.salvar(doc, usuario);
    return { dados: await this.ler(doc._id), avisos: [], erros: [] };
  }

  async revogar(id: string, usuario: UsuarioSessao) {
    this.exigirGestor(usuario);
    const doc = await this.exigir(id, usuario);
    const agora = new Date();
    const lista = listaDe(doc.get('lgpd.consentimentos')).map((item) => ({
      ...item,
      revogadoEm: item.revogadoEm ?? agora,
    }));
    doc.set('lgpd.revogadoEm', agora);
    doc.set('lgpd.contatoComercial', 'revogado');
    doc.set('lgpd.consentimentos', lista);
    doc.markModified('lgpd.consentimentos');
    await this.salvar(doc, usuario);
    return { dados: await this.ler(doc._id), avisos: [], erros: [] };
  }

  async eliminar(id: string, usuario: UsuarioSessao) {
    this.exigirGestor(usuario);
    const doc = await this.exigir(id, usuario);
    for (const campo of ['nome', 'nomeSocial', 'observacoes'] as const) doc.set(campo, null);
    doc.set('emails', []);
    doc.set('telefones', []);
    doc.set('enderecos', []);
    doc.set('pf', {});
    for (const campo of [
      'pj.razaoSocial',
      'pj.nomeFantasia',
      'pj.cnpjCifrado',
      'pj.cnpjHash',
      'pj.cnpjMascarado',
      'origem.payloadBruto',
    ]) {
      doc.set(campo, null);
    }
    doc.set('pj.responsavelTecnico', null);
    doc.set('pj.contatos', []);
    doc.set('origem.enriquecimentoBruto', []);
    doc.set('lgpd.eliminadoEm', new Date());
    await this.salvar(doc, usuario);
    return { dados: await this.ler(doc._id), avisos: [], erros: [] };
  }

  async tentarContato(id: string, usuario: UsuarioSessao) {
    const doc = await this.exigir(id, usuario);
    const lgpd = doc.get('lgpd') as Parameters<typeof contatoComercialLiberado>[0];
    const modo = (doc.get('origem') as { modo?: string } | undefined)?.modo;
    if (!contatoComercialLiberado(lgpd) && !importadoLiberado(lgpd, modo)) {
      throw new RespostaComErro(
        403,
        'CONTATO_COMERCIAL_BLOQUEADO',
        'Este lead está sem consentimento de contato comercial. Nada foi enviado.',
        doc.toObject(),
      );
    }
    return { dados: doc.toObject(), avisos: [], erros: [] };
  }

  private async exigir(id: string, usuario: UsuarioSessao): Promise<DocMutavel> {
    if (!Types.ObjectId.isValid(id)) this.ausente();
    const doc = await this.contatos.findById(id);
    if (!doc) this.ausente();
    const atual = doc as unknown as DocMutavel;
    const vendedor = atual.get('origem.vendedorAtribuido');
    if (
      !podeAcessarCarteira(
        usuario.papel,
        usuario.id,
        vendedor ? String(vendedor) : undefined,
        'editar_contato',
      )
    ) {
      throw new RespostaComErro(
        403,
        'PAPEL_INSUFICIENTE',
        'Seu papel não altera este contato. Nada foi gravado.',
        null,
      );
    }
    return atual;
  }

  private exigirGestor(usuario: UsuarioSessao): void {
    if (usuario.papel === 'gestor' || usuario.papel === 'admin') return;
    throw new RespostaComErro(
      403,
      'PAPEL_INSUFICIENTE',
      'Revogação e eliminação ficam com gestor ou admin, porque o canal do titular ainda não foi definido. Nada foi apagado.',
      null,
    );
  }

  private ausente(): never {
    throw new RespostaComErro(
      404,
      'CONTATO_AUSENTE',
      'Não achei esse contato. Nada foi alterado.',
      null,
    );
  }

  private async salvar(doc: DocMutavel, usuario: UsuarioSessao): Promise<void> {
    doc.$locals.autorId = new Types.ObjectId(usuario.id);
    doc.$locals.autorNome = usuario.nome;
    await doc.save();
  }

  private async ler(id: Types.ObjectId): Promise<Record<string, unknown>> {
    const gravado = await this.contatos.findById(id).lean();
    return (gravado ?? {}) as Record<string, unknown>;
  }
}

export function gravarConcessao(
  doc: {
    get(caminho: string): unknown;
    set(caminho: string, valor: unknown): unknown;
    markModified(caminho: string): void;
  },
  responsavelId: string,
  canal: 'vendedor_evento' | 'autocadastro',
  emDispositivo: string | undefined,
  envioErp = false,
): void {
  const texto = textoDoTermo();
  const agora = new Date();
  const dispositivo = dataDe(emDispositivo) ?? agora;
  const lista = listaDe(doc.get('lgpd.consentimentos'));
  const prova = {
    emDispositivo: dispositivo,
    emServidor: agora,
    versaoTermo: texto.versao,
    hashTexto: texto.hash,
    canal,
    responsavelId: new Types.ObjectId(responsavelId),
  };
  lista.push({ finalidade: 'contato_comercial', ...prova });
  if (envioErp) lista.push({ finalidade: 'envio_erp', ...prova });
  doc.set('lgpd.consentimentos', lista);
  doc.set('lgpd.contatoComercial', 'concedido');
  doc.set('lgpd.consentimentoEm', agora);
  doc.set('lgpd.versaoTermo', texto.versao);
  doc.set('lgpd.baseLegal', 'consentimento');
  doc.set(
    'lgpd.finalidade',
    envioErp ? ['contato comercial', 'envio ao erp'] : ['contato comercial'],
  );
  doc.set('lgpd.canalColeta', canal);
  const locais = (doc as { $locals?: { baseLegalExplicita?: boolean } }).$locals;
  if (locais) locais.baseLegalExplicita = true;
  doc.markModified('lgpd.consentimentos');
}

function listaDe(valor: unknown): Record<string, unknown>[] {
  if (!Array.isArray(valor)) return [];
  return valor.map((item) =>
    item && typeof item === 'object' ? { ...(item as Record<string, unknown>) } : {},
  );
}

function dataDe(valor: string | undefined): Date | null {
  if (!valor) return null;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data;
}
