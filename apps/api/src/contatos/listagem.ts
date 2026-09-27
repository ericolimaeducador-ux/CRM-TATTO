import { Types, type Connection, type Model } from 'mongoose';
import { plano, textoDeBusca } from './contato-escrita';
import { STATUS_CONTATO, TIPOS_PESSOA, type Contato } from './schemas/contato.schema';
import type { UsuarioSessao } from './sessao.middleware';

const ORIGENS = [
  'qr_lido',
  'qr_proprio',
  'manual',
  'google_forms',
  'importacao',
  'importado',
] as const;
const CONSENTIMENTOS = ['pendente', 'concedido', 'revogado'] as const;
const ORDENS = ['recente', 'antigo', 'nome'] as const;

export interface ConsultaListagem {
  cursor?: string;
  limite?: string;
  q?: string;
  status?: string;
  origem?: string;
  pessoa?: string;
  consentimento?: string;
  desde?: string;
  ate?: string;
  ordem?: string;
}

type Ordem = (typeof ORDENS)[number];

export function filtroDaCarteira(usuario: UsuarioSessao): Record<string, unknown> {
  if (usuario.papel !== 'vendedor') return {};
  return { 'origem.vendedorAtribuido': new Types.ObjectId(usuario.id) };
}

export function completarFiltro(
  filtro: Record<string, unknown>,
  consulta: ConsultaListagem,
): { ordem: Ordem; sort: Record<string, 1 | -1> } {
  if (umDe(consulta.status, STATUS_CONTATO)) filtro.status = consulta.status;
  if (umDe(consulta.origem, ORIGENS)) filtro['origem.modo'] = consulta.origem;
  if (umDe(consulta.pessoa, TIPOS_PESSOA)) filtro.tipoPessoa = consulta.pessoa;
  if (umDe(consulta.consentimento, CONSENTIMENTOS)) {
    filtro['lgpd.contatoComercial'] = consulta.consentimento;
  }
  const faixa = intervalo(consulta.desde, consulta.ate);
  if (faixa) filtro.criadoEm = faixa;
  const ordem: Ordem = umDe(consulta.ordem, ORDENS) ? (consulta.ordem as Ordem) : 'recente';
  if (ordem === 'nome') return { ordem, sort: { nome: 1, _id: 1 } };
  if (ordem === 'antigo') return { ordem, sort: { _id: 1 } };
  return { ordem: 'recente', sort: { _id: -1 } };
}

export function aplicarCursor(
  filtro: Record<string, unknown>,
  cursor: string | undefined,
  ordem: Ordem,
): void {
  if (!cursor) return;
  if (ordem === 'nome') {
    const sep = cursor.indexOf('\n');
    if (sep < 1) return;
    const nome = cursor.slice(0, sep);
    const id = cursor.slice(sep + 1);
    if (!Types.ObjectId.isValid(id)) return;
    const extra = {
      $or: [{ nome: { $gt: nome } }, { nome, _id: { $gt: new Types.ObjectId(id) } }],
    };
    const anterior = Array.isArray(filtro.$and) ? filtro.$and : [];
    filtro.$and = [...anterior, extra];
    return;
  }
  if (!Types.ObjectId.isValid(cursor)) return;
  filtro._id =
    ordem === 'antigo' ? { $gt: new Types.ObjectId(cursor) } : { $lt: new Types.ObjectId(cursor) };
}

export function cursorDe(item: Record<string, unknown>, ordem: Ordem): string {
  const id = String(item._id);
  if (ordem === 'nome') return `${String(item.nome ?? '')}\n${id}`;
  return id;
}

export function semSegredoDeDocumento(doc: Record<string, unknown>): Record<string, unknown> {
  return {
    ...doc,
    pf: semChaves(doc.pf, ['cpfCifrado', 'cpfHash']),
    pj: semChaves(doc.pj, ['cnpjCifrado', 'cnpjHash']),
  };
}

export function inicioDoDiaEmSaoPaulo(agora: Date): Date {
  const data = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora);
  return new Date(`${data}T00:00:00.000-03:00`);
}

export function inicioDaSemanaEmSaoPaulo(agora: Date): Date {
  const dia = inicioDoDiaEmSaoPaulo(agora);
  const semana = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
  }).format(agora);
  const indice = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(semana);
  const voltar = indice <= 0 ? 6 : indice - 1;
  return new Date(dia.getTime() - voltar * 24 * 60 * 60 * 1000);
}

export async function executarListagem(
  contatos: Model<Contato>,
  conexao: Connection,
  usuario: UsuarioSessao,
  consulta: ConsultaListagem,
) {
  const limite = Math.min(Math.max(Number(consulta.limite) || 20, 1), 100);
  const filtro = filtroDaCarteira(usuario);
  const busca = textoDeBusca(consulta.q);
  if (busca) {
    filtro.$or = [
      { nome: busca },
      { 'emails.valor': busca },
      { 'telefones.e164': busca },
      { 'telefones.bruto': busca },
    ];
  }
  const { ordem, sort } = completarFiltro(filtro, consulta);
  const semCursor: Record<string, unknown> = { ...filtro };
  aplicarCursor(filtro, consulta.cursor, ordem);
  const [total, itens] = await Promise.all([
    contatos.countDocuments(semCursor),
    contatos
      .find(filtro)
      .sort(sort)
      .limit(limite + 1)
      .lean(),
  ]);
  const pagina = itens.slice(0, limite).map((item) => semSegredoDeDocumento(plano(item)));
  await conexao.collection('acessos_dados').insertOne({
    usuario: new Types.ObjectId(usuario.id),
    acao: 'listagem',
    filtro,
    quantidadeRetornada: pagina.length,
    em: new Date(),
  });
  const ultimo = pagina.at(-1);
  return {
    dados: pagina,
    total,
    proximoCursor: itens.length > limite && ultimo ? cursorDe(ultimo, ordem) : null,
  };
}

export async function executarResumo(contatos: Model<Contato>, usuario: UsuarioSessao) {
  const filtro = filtroDaCarteira(usuario);
  const agora = new Date();
  const hoje = inicioDoDiaEmSaoPaulo(agora);
  const semana = inicioDaSemanaEmSaoPaulo(agora);
  const [contagemHoje, contagemSemana, grupos] = await Promise.all([
    contatos.countDocuments({ ...filtro, criadoEm: { $gte: hoje } }),
    contatos.countDocuments({ ...filtro, criadoEm: { $gte: semana } }),
    contatos.aggregate<{ _id?: string; n: number }>([
      { $match: filtro },
      { $group: { _id: '$status', n: { $sum: 1 } } },
    ]),
  ]);
  const porStatus: Record<(typeof STATUS_CONTATO)[number], number> = {
    rascunho: 0,
    capturado: 0,
    qualificado: 0,
    cliente: 0,
    descartado: 0,
  };
  for (const grupo of grupos) {
    if (grupo._id && grupo._id in porStatus) {
      porStatus[grupo._id as keyof typeof porStatus] = grupo.n;
    }
  }
  return { dados: { hoje: contagemHoje, semana: contagemSemana, porStatus } };
}

function umDe(valor: string | undefined, lista: readonly string[]): boolean {
  return Boolean(valor && lista.includes(valor));
}

function intervalo(desde?: string, ate?: string): Record<string, Date> | undefined {
  const inicio = dataDe(desde);
  const fim = dataDe(ate);
  if (!inicio && !fim) return undefined;
  const faixa: Record<string, Date> = {};
  if (inicio) faixa.$gte = inicio;
  if (fim) faixa.$lt = new Date(fim.getTime() + 24 * 60 * 60 * 1000);
  return faixa;
}

function dataDe(valor?: string): Date | undefined {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return undefined;
  const data = new Date(`${valor}T00:00:00.000-03:00`);
  return Number.isNaN(data.getTime()) ? undefined : data;
}

function semChaves(valor: unknown, chaves: string[]): unknown {
  if (!valor || typeof valor !== 'object') return valor;
  const saida = { ...(valor as Record<string, unknown>) };
  for (const chave of chaves) delete saida[chave];
  return saida;
}
