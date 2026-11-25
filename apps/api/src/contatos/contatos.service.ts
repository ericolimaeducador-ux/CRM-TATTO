import { Injectable } from '@nestjs/common';
import { hmacDocumento } from '../seguranca/cifra';
import { publicarContatoAlterado } from './contato-alterado';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Types, type Model } from 'mongoose';
import { podeAcessarCarteira } from '../auth/perfil-permissoes';
import type { Aviso } from '../normalizacao/avisos';
import {
  duplicidadeNomeada,
  ehDuplicidadeDocumento,
  ehIdLocalDuplicado,
  idDoVendedor,
  plano,
  semCaminhosPontilhados,
} from './contato-escrita';
import { ErroNomeado } from './schemas/erro-nomeado';
import type { Contato } from './schemas/contato.schema';
import { montarCriacao, montarPatch } from './aplicar-campo';
import { aplicarCompletude, vistaComSet } from './completude-contato';
import type { CriarContatoDto } from './criar-contato.dto';
import { RespostaComErro } from './erros-http';
import { executarListagem, executarResumo, type ConsultaListagem } from './listagem';
import type { UsuarioSessao } from './sessao.middleware';
import { pseudonimizarAutor } from './schemas/pseudonimo';

export interface Escrita {
  http: number;
  dados: Record<string, unknown>;
  avisos: Aviso[];
  antes?: Record<string, unknown> | null;
}

const LIMITE_ATRIBUICAO = 500;

/** Desinteressado volta a ser lembrado depois de 6 meses (ADR-029). */
export const RETOMADA_DESINTERESSADO_DIAS = 180;

@Injectable()
export class ContatosService {
  constructor(
    @InjectModel('Contato') private readonly contatos: Model<Contato>,
    @InjectConnection() private readonly conexao: Connection,
  ) {}

  async criar(corpo: CriarContatoDto, usuario: UsuarioSessao): Promise<Escrita> {
    if (corpo.idLocal) {
      const existente = await this.contatos.findOne({ idLocal: corpo.idLocal }).lean();
      if (existente)
        return {
          http: 200,
          dados: await this.exigir(String(existente._id), usuario, 'ler_contato'),
          avisos: [],
        };
    }
    const montado = montarCriacao(corpo);
    aplicarCompletude(montado.doc, montado.documentoValido);
    const origem = montado.doc.origem as Record<string, unknown>;
    origem.vendedorAtribuido = new Types.ObjectId(usuario.id);
    if (origem.modo !== 'qr_proprio' && origem.modo !== 'google_forms') {
      origem.capturadoPor = new Types.ObjectId(usuario.id);
    }
    montado.doc.avisos = montado.avisos;
    montado.doc.sincronizadoEm = new Date();
    const contato = new this.contatos(semCaminhosPontilhados(montado.doc));
    contato.set('lgpd.contatoComercial', 'pendente');
    contato.set('lgpd.consentimentos', []);
    this.injetarLocais(contato, usuario, montado.cpfPuro, montado.cnpjPuro);
    try {
      await contato.save();
    } catch (erro) {
      if (ehIdLocalDuplicado(erro) && corpo.idLocal) {
        const existente = await this.contatos.findOne({ idLocal: corpo.idLocal }).lean();
        if (existente)
          return {
            http: 200,
            dados: await this.exigir(String(existente._id), usuario, 'ler_contato'),
            avisos: montado.avisos,
          };
      }
      if (erro instanceof ErroNomeado) {
        contato.set('status', 'rascunho');
        this.injetarLocais(contato, usuario, montado.cpfPuro, montado.cnpjPuro);
        await contato.save();
        throw new RespostaComErro(
          422,
          erro.codigo,
          erro.message,
          plano(contato.toObject()),
          montado.avisos,
        );
      }
      throw erro;
    }
    const gravado = await this.contatos.findById(contato._id).lean();
    return { http: 201, dados: plano(gravado), avisos: montado.avisos };
  }

  async patch(
    id: string,
    campo: string | undefined,
    valor: unknown,
    versaoConhecida: number | undefined,
    usuario: UsuarioSessao,
  ): Promise<Escrita> {
    const antes = await this.exigir(id, usuario, 'editar_contato');
    if (versaoConhecida !== undefined && antes.versao !== versaoConhecida) {
      throw new RespostaComErro(
        422,
        'CONFLITO_VERSAO',
        'Este contato mudou em outro aparelho. Escolha campo a campo qual valor fica. Nada foi sobrescrito.',
        await this.marcarConflito(id, campo, valor, versaoConhecida, antes),
      );
    }
    const patch = montarPatch(antes, campo, valor);
    if (Object.keys(patch.set).length === 0) {
      return { http: 200, dados: antes, avisos: patch.avisos, antes };
    }
    const vista = vistaComSet(antes, patch.set);
    aplicarCompletude(vista, patch.documentoValido);
    patch.set.status = vista.status;
    patch.set.completude = vista.completude;
    patch.set.avisos = patch.avisos;
    const gravado = await this.atualizarCondicional(id, antes, patch.set, patch.unset, usuario);
    if (!gravado) {
      const atual = plano(await this.contatos.findById(id).lean());
      throw new RespostaComErro(
        422,
        'CONFLITO_VERSAO',
        'Este contato mudou em outro aparelho. Escolha campo a campo qual valor fica. Nada foi sobrescrito.',
        await this.marcarConflito(id, campo, valor, versaoConhecida, atual),
      );
    }
    await publicarContatoAlterado({ contatoId: id, autorId: usuario.id });
    return { http: 200, dados: gravado, avisos: patch.avisos, antes };
  }

  /**
   * Triagem do SDR (ADR-029/030): interessado entra na carteira; desinteressado sai das
   * campanhas e volta a ser lembrado em 6 meses; "pediu para sair" bloqueia o WhatsApp
   * de vez (como responder SAIR) e nunca volta sozinho. Um clique, sem exigir dados.
   */
  async triar(id: string, situacaoBruta: unknown, motivoBruto: unknown, usuario: UsuarioSessao) {
    if (
      situacaoBruta !== 'interessado' &&
      situacaoBruta !== 'desinteressado' &&
      situacaoBruta !== 'saiu'
    )
      throw new RespostaComErro(
        422,
        'TRIAGEM_INVALIDA',
        'Escolha Interessado, Desinteressado ou Pediu para sair. Nada foi alterado.',
        null,
      );
    const motivo = typeof motivoBruto === 'string' ? motivoBruto.trim().slice(0, 500) : '';
    const antes = await this.exigir(id, usuario, 'editar_contato');
    const agora = new Date();
    const retomarEm =
      situacaoBruta === 'desinteressado'
        ? new Date(agora.getTime() + RETOMADA_DESINTERESSADO_DIAS * 86_400_000)
        : undefined;
    const triagem = {
      situacao: situacaoBruta,
      em: agora,
      por: new Types.ObjectId(usuario.id),
      ...(motivo ? { motivo } : {}),
      ...(retomarEm ? { retomarEm } : {}),
    };
    const r = await this.contatos.updateOne(
      { _id: id, versao: antes.versao },
      {
        $set: { triagem, alteradoEm: agora, alteradoPor: new Types.ObjectId(usuario.id) },
        $inc: { versao: 1 },
      },
    );
    if (r.matchedCount === 0)
      throw new RespostaComErro(
        422,
        'CONFLITO_VERSAO',
        'O contato mudou enquanto a triagem era registrada. Abra de novo e tente outra vez.',
        null,
      );
    if (situacaoBruta === 'saiu') {
      // Mesmo efeito de responder SAIR: nenhum WhatsApp de campanha para estes números.
      const telefones = ((antes as { telefones?: { e164?: string }[] }).telefones ?? [])
        .map((t) => String(t.e164 ?? '').replace(/\D/g, ''))
        .filter((d) => /^[1-9]\d{7,14}$/.test(d));
      for (const digitos of new Set(telefones))
        await this.conexao
          .collection('whatsapp_bloqueios')
          .updateOne(
            { telefoneHash: hmacDocumento(`whatsapp:${digitos}`) },
            { $setOnInsert: { em: agora, origem: 'triagem_manual' } },
            { upsert: true },
          );
    }
    const anterior = (antes as { triagem?: { situacao?: string } }).triagem?.situacao ?? null;
    await this.conexao.collection('contatos_auditoria').insertOne({
      contatoId: new Types.ObjectId(id),
      versao: Number(antes.versao ?? 0) + 1,
      campo: 'triagem',
      valorAnterior: anterior,
      valorNovo: situacaoBruta,
      autor: new Types.ObjectId(usuario.id),
      autorNome: pseudonimizarAutor(usuario.nome ?? ''),
      timestampServidor: agora,
      motivo: 'triagem_sdr',
      origem: 'api',
    });
    await publicarContatoAlterado({ contatoId: id, autorId: usuario.id });
    return { dados: plano(await this.contatos.findById(id).lean()), avisos: [], erros: [] };
  }

  async atribuir(idsBrutos: unknown, responsavelBruto: unknown, usuario: UsuarioSessao) {
    const recusar = (mensagem: string, codigo = 'ATRIBUICAO_INVALIDA') => {
      throw new RespostaComErro(422, codigo, mensagem, null);
    };
    if (
      !Array.isArray(idsBrutos) ||
      idsBrutos.length === 0 ||
      idsBrutos.length > LIMITE_ATRIBUICAO ||
      !idsBrutos.every((id) => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id))
    )
      recusar(`Escolha de 1 a ${LIMITE_ATRIBUICAO} contatos. Nada foi alterado.`);
    const semResponsavel = responsavelBruto === null || responsavelBruto === 'sem';
    if (
      !semResponsavel &&
      (typeof responsavelBruto !== 'string' || !/^[a-f\d]{24}$/i.test(responsavelBruto))
    )
      recusar('Escolha quem vai cuidar destes contatos. Nada foi alterado.');
    const responsavel = semResponsavel ? null : new Types.ObjectId(responsavelBruto as string);
    if (responsavel) {
      const pessoa = await this.conexao
        .collection('usuarios')
        .findOne({ _id: responsavel }, { projection: { papel: 1, ativo: 1 } });
      if (
        !pessoa ||
        pessoa.ativo === false ||
        !['vendedor', 'gestor', 'admin'].includes(String(pessoa.papel))
      )
        recusar('Essa pessoa não está ativa na equipe. Nada foi alterado.', 'RESPONSAVEL_INVALIDO');
    }
    const ids = [...new Set(idsBrutos as string[])].map((id) => new Types.ObjectId(id));
    const atuais = await this.contatos
      .find(
        {
          _id: { $in: ids },
          'lgpd.eliminadoEm': { $exists: false },
          fundidoEm: { $exists: false },
        },
        { _id: 1, versao: 1, status: 1, 'origem.vendedorAtribuido': 1 },
      )
      .lean();
    const agora = new Date();
    const autor = new Types.ObjectId(usuario.id);
    let atribuidos = 0;
    for (const atual of atuais) {
      const anterior = idDoVendedor(atual as unknown as Record<string, unknown>) ?? null;
      if (anterior === (responsavel ? String(responsavel) : null)) continue;
      const r = await this.contatos.updateOne(
        { _id: atual._id, versao: atual.versao },
        {
          ...(responsavel
            ? {
                $set: {
                  'origem.vendedorAtribuido': responsavel,
                  alteradoEm: agora,
                  alteradoPor: autor,
                },
              }
            : {
                $set: { alteradoEm: agora, alteradoPor: autor },
                $unset: { 'origem.vendedorAtribuido': '' },
              }),
          $inc: { versao: 1 },
        },
      );
      if (r.matchedCount === 0) continue;
      atribuidos += 1;
      await this.conexao.collection('contatos_auditoria').insertOne({
        contatoId: atual._id,
        versao: (atual.versao ?? 0) + 1,
        campo: 'responsavel',
        valorAnterior: anterior,
        valorNovo: responsavel ? String(responsavel) : null,
        autor,
        autorNome: pseudonimizarAutor(usuario.nome ?? ''),
        timestampServidor: agora,
        motivo: 'atribuicao_carteira',
        origem: 'api',
      });
      await publicarContatoAlterado({ contatoId: String(atual._id), autorId: usuario.id });
    }
    return {
      dados: {
        atribuidos,
        semMudanca: atuais.length - atribuidos,
        naoEncontrados: ids.length - atuais.length,
      },
      avisos: [],
      erros: [],
    };
  }

  listar(usuario: UsuarioSessao, consulta: ConsultaListagem) {
    return executarListagem(this.contatos, this.conexao, usuario, consulta);
  }

  resumo(usuario: UsuarioSessao) {
    return executarResumo(this.contatos, usuario);
  }

  async limparConflito(id: string, usuario: UsuarioSessao) {
    await this.exigir(id, usuario, 'editar_contato');
    await this.contatos.updateOne({ _id: id }, { $unset: { conflito: '' } });
    return this.obter(id, usuario);
  }

  async obter(id: string, usuario: UsuarioSessao) {
    const doc = await this.exigir(id, usuario, 'ler_contato');
    const dono = idDoVendedor(doc);
    if (dono !== usuario.id) {
      await this.conexao.collection('acessos_dados').insertOne({
        usuario: new Types.ObjectId(usuario.id),
        acao: 'leitura',
        contatoId: doc._id,
        em: new Date(),
      });
    }
    return doc;
  }

  async exigir(
    id: string,
    usuario: UsuarioSessao,
    acao: 'ler_contato' | 'editar_contato',
  ): Promise<Record<string, unknown>> {
    if (!Types.ObjectId.isValid(id)) {
      throw new RespostaComErro(
        404,
        'CONTATO_AUSENTE',
        'Não achei esse contato. Confira o identificador e abra a lista.',
        null,
      );
    }
    const doc = await this.contatos.findById(id).lean();
    if (!doc) {
      throw new RespostaComErro(
        404,
        'CONTATO_AUSENTE',
        'Não achei esse contato. Ele pode ter ficado só no outro aparelho.',
        null,
      );
    }
    const planoDoc = plano(doc);
    if (!podeAcessarCarteira(usuario.papel, usuario.id, idDoVendedor(planoDoc), acao)) {
      throw new RespostaComErro(
        403,
        'PAPEL_INSUFICIENTE',
        'Esse contato está na carteira de outra pessoa. Peça a um gestor se a tarefa é sua.',
        null,
      );
    }
    return planoDoc;
  }

  private async atualizarCondicional(
    id: string,
    antes: Record<string, unknown>,
    set: Record<string, unknown>,
    unset: Record<string, ''>,
    usuario: UsuarioSessao,
  ): Promise<Record<string, unknown> | null> {
    const atualizacao: Record<string, unknown> = {
      $set: {
        ...set,
        alteradoEm: new Date(),
        alteradoPor: new Types.ObjectId(usuario.id),
        sincronizadoEm: new Date(),
      },
      $inc: { versao: 1 },
      $unset: { ...unset, conflito: '' },
    };
    try {
      const resultado = await this.contatos.updateOne(
        { _id: id, versao: antes.versao },
        atualizacao,
      );
      if (resultado.matchedCount === 0) return null;
    } catch (erro) {
      if (!(erro instanceof ErroNomeado) && !ehDuplicidadeDocumento(erro)) throw erro;
      const nomeado = erro instanceof ErroNomeado ? erro : duplicidadeNomeada(erro);
      const documento = nomeado?.codigo === 'CNPJ_DUPLICADO' ? 'CNPJ' : 'CPF';
      throw new RespostaComErro(
        422,
        nomeado?.codigo ?? 'CPF_DUPLICADO',
        `Já existe um contato fora de rascunho com este ${documento}. A edição não foi gravada.`,
        antes,
        (set.avisos as Aviso[] | undefined) ?? [],
      );
    }
    return plano(await this.contatos.findById(id).lean());
  }

  private async marcarConflito(
    id: string,
    campo: string | undefined,
    valor: unknown,
    versaoConhecida: number | undefined,
    atual: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const conflito = {
      detectadoEm: new Date(),
      campo: campo ?? '',
      versaoLocal: { versao: versaoConhecida ?? null, valor: valor ?? null },
      versaoServidor: {
        versao: atual.versao ?? null,
        valor: campo ? (atual[campo] ?? null) : null,
      },
    };
    await this.contatos.updateOne({ _id: id }, { $set: { conflito } });
    return { ...atual, conflito };
  }

  private injetarLocais(
    contato: { $locals: Record<string, unknown> },
    usuario: UsuarioSessao,
    cpfPuro?: string,
    cnpjPuro?: string,
  ): void {
    contato.$locals.autorId = new Types.ObjectId(usuario.id);
    contato.$locals.autorNome = usuario.nome;
    if (cpfPuro) contato.$locals.cpfPuro = cpfPuro;
    if (cnpjPuro) contato.$locals.cnpjPuro = cnpjPuro;
  }
}
