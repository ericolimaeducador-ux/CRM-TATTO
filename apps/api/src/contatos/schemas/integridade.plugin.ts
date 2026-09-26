import { randomUUID } from 'node:crypto';
import type { HydratedDocument, Model, Schema } from 'mongoose';
import type { Types } from 'mongoose';
import {
  AutorObrigatorio,
  ErroNomeado,
  ExclusaoFisicaProibida,
  type CodigoDuplicidade,
} from './erro-nomeado';
import { pseudonimizarAutor, pseudonimizarCampo } from './pseudonimo';

const CAMPOS_AUTORIA = ['criadoPor', 'alteradoPor', 'criadoEm', 'alteradoEm'] as const;
const IGNORADOS_NA_AUDITORIA = new Set([
  'alteradoEm',
  'alteradoPor',
  'criadoEm',
  'criadoPor',
  'versao',
  'sincronizadoEm',
]);

interface LocalsIntegridade {
  autorId?: Types.ObjectId;
  autorNome?: string;
  auditoriaPendente?: Difereca[];
}

interface Difereca {
  campo: string;
  valorAnterior: unknown;
  valorNovo: unknown;
}

interface DocumentoIntegridade {
  isNew: boolean;
  isModified(caminho?: string): boolean;
  get(caminho: string): unknown;
  set(caminho: string, valor: unknown): unknown;
  modifiedPaths(): string[];
  $locals: LocalsIntegridade;
  model<T = unknown>(nome: string): Model<T>;
  _id: Types.ObjectId;
}

export function aplicarIntegridade(schema: Schema): void {
  schema.pre('save', async function identidadeEAutoria() {
    const doc = this as unknown as DocumentoIntegridade;
    avisarAutoriaDoCliente(doc);
    const agora = new Date();
    if (doc.isNew) {
      if (!doc.get('idLocal')) doc.set('idLocal', randomUUID());
      if (!doc.get('codigo')) doc.set('codigo', await proximoCodigo(doc));
      doc.set('criadoEm', agora);
      doc.set('criadoPor', doc.$locals.autorId);
    }
    doc.set('alteradoEm', agora);
    doc.set('alteradoPor', doc.$locals.autorId ?? doc.get('criadoPor'));
    if (!doc.isNew) doc.set('versao', Number(doc.get('versao') ?? 1) + 1);
  });

  schema.pre('save', async function prepararAuditoria() {
    const doc = this as unknown as DocumentoIntegridade;
    if (doc.isNew) return;
    const anterior = await doc
      .model('Contato')
      .findById(doc._id)
      .lean<{ status?: string } & Record<string, unknown>>();
    if (!anterior || anterior.status === 'rascunho') return;
    const diffs = diferencas(doc, anterior);
    if (diffs.length === 0) return;
    if (!doc.$locals.autorId) throw new AutorObrigatorio();
    doc.$locals.auditoriaPendente = diffs;
  });

  schema.post('save', async function gravarAuditoria(docSalvo: HydratedDocument<unknown>) {
    const doc = docSalvo as unknown as DocumentoIntegridade;
    const diffs = doc.$locals.auditoriaPendente;
    if (!diffs || diffs.length === 0) return;
    const autor = doc.$locals.autorId;
    if (!autor) throw new AutorObrigatorio();
    const Auditoria = doc.model('ContatoAuditoria');
    await Auditoria.insertMany(
      diffs.map((diff) => ({
        contatoId: doc._id,
        versao: doc.get('versao'),
        campo: diff.campo,
        valorAnterior: pseudonimizarCampo(diff.campo, diff.valorAnterior),
        valorNovo: pseudonimizarCampo(diff.campo, diff.valorNovo),
        autor,
        autorNome: pseudonimizarAutor(doc.$locals.autorNome ?? 'sem nome'),
        timestampServidor: new Date(),
        origem: 'api',
      })),
    );
    doc.$locals.auditoriaPendente = [];
  });

  schema.post('save', { errorHandler: true }, function traduzirDuplicidade(erro, _doc, next) {
    next(traduzirErroDeIndice(erro) ?? erro);
  });

  for (const operacao of ['deleteOne', 'deleteMany', 'findOneAndDelete'] as const) {
    schema.pre(operacao, { document: false, query: true }, function bloquearConsulta() {
      throw new ExclusaoFisicaProibida();
    });
    schema.pre(operacao, { document: true, query: false }, function bloquearDocumento() {
      throw new ExclusaoFisicaProibida();
    });
  }
}

function avisarAutoriaDoCliente(doc: DocumentoIntegridade): void {
  const campos = CAMPOS_AUTORIA.filter((campo) => {
    if (doc.get(campo) == null) return false;
    return doc.isNew || doc.isModified(campo);
  });
  if (campos.length === 0) return;
  console.warn(
    JSON.stringify({
      nivel: 'WARN',
      evento: 'tentativa_autoria_cliente',
      campos,
      em: new Date().toISOString(),
    }),
  );
}

async function proximoCodigo(doc: DocumentoIntegridade): Promise<string> {
  const Contador = doc.model<{ _id: string; seq: number }>('Contador');
  const ano = new Date().getFullYear();
  const resultado = await Contador.findOneAndUpdate(
    { _id: `contato-${ano}` },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
  return `LD-${ano}-${String(extrairSeq(resultado)).padStart(5, '0')}`;
}

function extrairSeq(resultado: unknown): number {
  if (resultado && typeof resultado === 'object') {
    if ('seq' in resultado && typeof resultado.seq === 'number') return resultado.seq;
    if (
      'value' in resultado &&
      resultado.value &&
      typeof resultado.value === 'object' &&
      'seq' in resultado.value
    ) {
      const seq = (resultado.value as { seq: unknown }).seq;
      if (typeof seq === 'number') return seq;
    }
  }
  throw new Error('Contador de código não devolveu sequência.');
}

function diferencas(doc: DocumentoIntegridade, anterior: Record<string, unknown>): Difereca[] {
  const caminhos = caminhosFolha(doc.modifiedPaths()).filter(
    (caminho) => !IGNORADOS_NA_AUDITORIA.has(caminho),
  );
  const diffs: Difereca[] = [];
  for (const campo of caminhos) {
    const valorAnterior = lerCaminho(anterior, campo);
    const valorNovo = doc.get(campo);
    if (JSON.stringify(valorAnterior) === JSON.stringify(valorNovo)) continue;
    diffs.push({ campo, valorAnterior, valorNovo });
  }
  return diffs;
}

function caminhosFolha(caminhos: string[]): string[] {
  return caminhos.filter(
    (caminho) => !caminhos.some((outro) => outro !== caminho && outro.startsWith(`${caminho}.`)),
  );
}

function lerCaminho(origem: unknown, caminho: string): unknown {
  return caminho.split('.').reduce<unknown>((acc, parte) => {
    if (acc && typeof acc === 'object' && parte in acc) {
      return (acc as Record<string, unknown>)[parte];
    }
    return undefined;
  }, origem);
}

function traduzirErroDeIndice(erro: unknown): ErroNomeado | undefined {
  if (!erro || typeof erro !== 'object' || !('code' in erro) || erro.code !== 11000)
    return undefined;
  const texto = JSON.stringify(erro);
  const codigo = codigoPeloIndice(texto);
  if (!codigo) return undefined;
  const documento = codigo === 'CPF_DUPLICADO' ? 'CPF' : 'CNPJ';
  return new ErroNomeado(
    codigo,
    `Já existe um contato fora de rascunho com este ${documento}. Abra a duplicata e peça a um gestor para decidir. Este registro não foi promovido e o rascunho continua editável.`,
  );
}

function codigoPeloIndice(texto: string): CodigoDuplicidade | undefined {
  if (texto.includes('cpfHash') || texto.includes('uniq_pf_cpfHash')) return 'CPF_DUPLICADO';
  if (texto.includes('cnpjHash') || texto.includes('uniq_pj_cnpjHash')) return 'CNPJ_DUPLICADO';
  return undefined;
}
