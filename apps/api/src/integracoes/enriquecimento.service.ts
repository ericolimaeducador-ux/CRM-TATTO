import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types, type Model } from 'mongoose';
import { podeAcessarCarteira } from '../auth/perfil-permissoes';
import { aplicarCompletude } from '../contatos/completude-contato';
import { RespostaComErro } from '../contatos/erros-http';
import type { Contato } from '../contatos/schemas/contato.schema';
import { ErroNomeado } from '../contatos/schemas/erro-nomeado';
import type { UsuarioSessao } from '../contatos/sessao.middleware';
import { aviso, type Aviso } from '../normalizacao/avisos';
import { apenasDigitos, cnpjValido } from '../normalizacao/documento';
import { aplicarOficial, type Sugestao } from './aplicar-oficial';
import { FontesOficiais, type ConsultaOficial } from './fontes-oficiais';

interface DocMutavel {
  toObject(): Record<string, unknown>;
  set(caminho: string, valor: unknown): unknown;
  get(caminho: string): unknown;
  markModified(caminho: string): void;
  unmarkModified(caminho: string): void;
  save(): Promise<unknown>;
  $locals: Record<string, unknown>;
}

export interface ResultadoEnriquecimento {
  dados: Record<string, unknown> | null;
  avisos: Aviso[];
  sugestoes: Sugestao[];
  erros: [];
}

@Injectable()
export class EnriquecimentoService {
  constructor(
    @InjectModel('Contato') private readonly contatos: Model<Contato>,
    private readonly fontes: FontesOficiais,
  ) {}

  async cnpj(
    contatoId: string | undefined,
    cnpj: string | undefined,
    usuario: UsuarioSessao,
  ): Promise<ResultadoEnriquecimento> {
    const doc = await this.exigir(contatoId, usuario);
    const digitos = apenasDigitos(cnpj ?? '');
    if (!cnpjValido(digitos)) {
      return responder(doc, [
        aviso(
          'cnpj',
          'CNPJ_INVALIDO',
          'CNPJ não confere o dígito. Nada foi consultado e o contato continua como está.',
        ),
      ]);
    }
    return this.gravar(doc, usuario, await this.fontes.cnpj(digitos));
  }

  async cep(
    contatoId: string | undefined,
    cep: string | undefined,
    usuario: UsuarioSessao,
  ): Promise<ResultadoEnriquecimento> {
    const doc = await this.exigir(contatoId, usuario);
    const digitos = apenasDigitos(cep ?? '');
    if (digitos.length !== 8) {
      return responder(doc, [
        aviso(
          'cep',
          'CEP_INVALIDO',
          'CEP precisa de 8 dígitos. Nada foi consultado e o contato continua como está.',
        ),
      ]);
    }
    return this.gravar(doc, usuario, await this.fontes.cep(digitos));
  }

  private async gravar(
    doc: DocMutavel,
    usuario: UsuarioSessao,
    consulta: ConsultaOficial,
  ): Promise<ResultadoEnriquecimento> {
    const statusAntes = String(doc.get('status') ?? 'rascunho');
    const antes = doc.toObject();
    const plano = JSON.parse(JSON.stringify(antes)) as Record<string, unknown>;
    const documentoJaValido =
      Boolean(objeto(plano.pj).cnpjHash) || Boolean(objeto(plano.pf).cpfHash);
    const origem = objeto(plano.origem);
    const bruto = Array.isArray(origem.enriquecimentoBruto) ? [...origem.enriquecimentoBruto] : [];
    if (consulta.payload) {
      bruto.push({ fonte: consulta.fonte, payload: consulta.payload, em: new Date() });
    }
    origem.enriquecimentoBruto = bruto;
    plano.origem = origem;
    let sugestoes: Sugestao[] = [];
    if (consulta.dado) {
      sugestoes = aplicarOficial(plano, consulta.dado, consulta.fonte).sugestoes;
      if (!objeto(plano.pj).cnpjHash && consulta.digitos) doc.$locals.cnpjPuro = consulta.digitos;
    }
    aplicarCompletude(plano, documentoJaValido || Boolean(doc.$locals.cnpjPuro));
    aplicarPlano(doc, plano, usuario);
    try {
      await doc.save();
    } catch (erro) {
      if (!(erro instanceof ErroNomeado)) throw erro;
      doc.set('status', statusAntes);
      if (statusAntes !== 'rascunho') restaurarDocumento(doc, antes);
      delete doc.$locals.cnpjPuro;
      aplicarPlano(doc, { status: statusAntes }, usuario);
      try {
        await doc.save();
      } catch {
        const fresco = await this.contatos.findById(doc.get('_id'));
        return responder((fresco as unknown as DocMutavel | null) ?? doc, [
          ...consulta.avisos,
          avisoDeDuplicidade(erro),
        ]);
      }
      consulta.avisos.push(avisoDeDuplicidade(erro));
    }
    return responder(doc, consulta.avisos, sugestoes);
  }

  private async exigir(contatoId: string | undefined, usuario: UsuarioSessao): Promise<DocMutavel> {
    if (!contatoId || !Types.ObjectId.isValid(contatoId)) {
      throw new RespostaComErro(
        404,
        'CONTATO_AUSENTE',
        'Não achei esse contato para enriquecer. Abra o cadastro e tente de novo. Nada foi consultado.',
        null,
      );
    }
    const doc = await this.contatos.findById(contatoId);
    if (!doc) {
      throw new RespostaComErro(
        404,
        'CONTATO_AUSENTE',
        'Não achei esse contato para enriquecer. Abra o cadastro e tente de novo. Nada foi consultado.',
        null,
      );
    }
    const origem = doc.get('origem') as { vendedorAtribuido?: unknown } | undefined;
    const dono = origem?.vendedorAtribuido ? String(origem.vendedorAtribuido) : undefined;
    if (!podeAcessarCarteira(usuario.papel, usuario.id, dono, 'editar_contato')) {
      throw new RespostaComErro(
        403,
        'PAPEL_INSUFICIENTE',
        'Esse contato está na carteira de outra pessoa. O enriquecimento não rodou.',
        null,
      );
    }
    return doc as unknown as DocMutavel;
  }
}

function aplicarPlano(
  doc: DocMutavel,
  plano: Record<string, unknown>,
  usuario: UsuarioSessao,
): void {
  doc.$locals.autorId = new Types.ObjectId(usuario.id);
  doc.$locals.autorNome = usuario.nome;
  for (const chave of [
    'pj',
    'origem',
    'emails',
    'telefones',
    'enderecos',
    'tipoPessoa',
    'status',
    'completude',
    'avisos',
  ] as const) {
    if (chave in plano) doc.set(chave, plano[chave]);
  }
  doc.markModified('pj');
  doc.markModified('origem');
  for (const campo of ['criadoPor', 'criadoEm', 'alteradoPor', 'alteradoEm']) {
    doc.unmarkModified(campo);
  }
}

function responder(
  doc: DocMutavel,
  avisos: Aviso[],
  sugestoes: Sugestao[] = [],
): ResultadoEnriquecimento {
  return {
    dados: JSON.parse(JSON.stringify(doc.toObject())) as Record<string, unknown>,
    avisos,
    sugestoes,
    erros: [],
  };
}

function avisoDeDuplicidade(erro: ErroNomeado): Aviso {
  return aviso(
    'cnpj',
    erro.codigo,
    'Já existe outro contato fora de rascunho com este documento. O enriquecimento não promoveu este e o contato continua salvo.',
  );
}

function restaurarDocumento(doc: DocMutavel, antes: Record<string, unknown>): void {
  const pjAntes = objeto(antes.pj);
  const pj = objeto(doc.get('pj'));
  pj.cnpjCifrado = pjAntes.cnpjCifrado;
  pj.cnpjHash = pjAntes.cnpjHash;
  pj.cnpjMascarado = pjAntes.cnpjMascarado;
  pj.cnpjRaiz = pjAntes.cnpjRaiz;
  doc.set('pj', pj);
  doc.markModified('pj');
}

function objeto(valor: unknown): Record<string, unknown> {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return {};
  return { ...(valor as Record<string, unknown>) };
}
