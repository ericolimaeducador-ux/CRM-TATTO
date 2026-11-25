import { useEffect, useState } from 'react';
import { urlDaApi } from '@/lib/api-url';
import {
  cabecalhosDaSessao,
  headersDeTesteNoCliente,
  perfilLogado,
  tokenDaSessao,
} from '@/lib/offline/sessao';

export type Secao = 'contas' | 'produtos' | 'oportunidades' | 'atividades' | 'propostas';
export interface ItemProposta {
  produtoId?: string;
  descricao: string;
  quantidade: number;
  precoUnitarioCentavos: number;
  descontoPercentual: number;
}
export interface PessoaConta {
  id: string;
  nome: string;
  cargo: string;
  email: string;
  telefone: string;
  principal: boolean;
  ativo: boolean;
  observacoes: string;
}
export interface UsuarioComercial {
  id: string;
  nome: string;
  papel?: string;
  ativo?: boolean;
}
export interface Registro {
  _id: string;
  secao: Secao;
  donoId: string;
  versao: number;
  criadoEm: string;
  alteradoEm: string;
  arquivado: boolean;
  nome?: string;
  titulo?: string;
  segmento?: string;
  cidade?: string;
  uf?: string;
  classificacao?: string;
  territorio?: string;
  especialidade?: string;
  frequenciaVisitaDias?: number;
  contatoNome?: string;
  contatoEmail?: string;
  contatoTelefone?: string;
  /** Conta criada a partir do contato qualificado (ADR-028). */
  contatoOrigemId?: string;
  pessoas?: PessoaConta[];
  contatoId?: string;
  endereco?: string;
  proximaVisita?: string;
  fabricante?: string;
  linha?: string;
  categoria?: string;
  unidade?: string;
  codigo?: string;
  descricao?: string;
  precoCentavos?: number;
  contaId?: string;
  oportunidadeId?: string;
  etapa?: string;
  valorCentavos?: number;
  probabilidade?: number;
  previsao?: string;
  motivoPerda?: string;
  tipo?: string;
  status?: string;
  canal?: string;
  data?: string;
  resultado?: string;
  realizacao?: string;
  realizadoEm?: string;
  realizadoPor?: string;
  responsavelId?: string;
  colaboradoresIds?: string[];
  proximaAcao?: string;
  observacoes?: string;
  local?: string;
  validade?: string;
  condicoesPagamento?: string;
  itens?: ItemProposta[];
  subtotalCentavos?: number;
  descontoCentavos?: number;
  totalCentavos?: number;
}
export interface Lista {
  registros: Registro[];
  total: number;
  pagina: number;
  limite: number;
}
export interface Evento {
  acao: string;
  autor: string;
  em: string;
  versao: number;
  campos: string[];
}
export interface Painel {
  indicadores: {
    contas: number;
    oportunidadesAbertas: number;
    pipelineCentavos: number;
    ganhoCentavos: number;
    visitasHoje: number;
    atividadesPendentes: number;
    atrasadas: number;
    propostasAbertas: number;
  };
  funil: { etapa: string; quantidade: number; valorCentavos: number }[];
  proximasAtividades: Registro[];
  contasRecentes: Registro[];
}
export const ETAPAS = [
  'prospeccao',
  'qualificacao',
  'apresentacao',
  'proposta',
  'negociacao',
  'ganho',
  'perdido',
];
export const ROTULOS: Record<string, string> = {
  prospeccao: 'Prospecção',
  qualificacao: 'Qualificação',
  apresentacao: 'Apresentação',
  proposta: 'Proposta',
  negociacao: 'Negociação',
  ganho: 'Ganho',
  perdido: 'Perdido',
  estudio_tatuagem: 'Estúdio de tatuagem',
  profissional_autonomo: 'Profissional autônomo',
  cosmetico: 'Cosmético',
  kit: 'Kit',
  hospital: 'Hospital',
  clinica: 'Clínica',
  farmacia: 'Farmácia',
  laboratorio: 'Laboratório',
  distribuidor: 'Distribuidor',
  consultorio: 'Consultório',
  outro: 'Outro',
  medicamento: 'Medicamento',
  dispositivo: 'Dispositivo médico',
  material: 'Material médico',
  equipamento: 'Equipamento',
  prospect: 'Prospecção',
  ativo: 'Ativo',
  inativo: 'Inativo',
  visita: 'Visita',
  ligacao: 'Ligação',
  email: 'E-mail',
  reuniao: 'Reunião',
  tarefa: 'Tarefa',
  planejada: 'Planejada',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
  presencial: 'Presencial',
  remoto: 'Remoto',
  rascunho: 'Rascunho',
  apresentada: 'Apresentada',
  aceita: 'Aceita',
  recusada: 'Recusada',
  criar: 'Criação',
  editar: 'Edição',
  arquivar: 'Arquivamento',
  restaurar: 'Restauração',
  solicitado: 'Solicitado',
  aguardando_aprovacao: 'Aguardando aprovação',
  aprovado: 'Aprovado',
  reprovado: 'Reprovado',
  aprovar: 'Aprovação',
  reprovar: 'Reprovação',
  encerrar_ganho: 'Encerramento com ganho',
  encerrar_perdido: 'Encerramento com perda',
  online: 'Online',
  planejado: 'Planejado',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
  inscrito: 'Inscrito',
  confirmado: 'Confirmado',
  presente: 'Presente',
  ausente: 'Ausente',
  gerar_qr: 'Geração de QR de inscrição',
};
export const rotulo = (valor?: string) => (valor ? (ROTULOS[valor] ?? valor) : 'Não informado');
export const nomeRegistro = (r?: Pick<Registro, 'nome' | 'titulo'>) =>
  r?.nome || r?.titulo || 'Rascunho sem nome';
export const moeda = (centavos = 0) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(centavos / 100);
export function dataFormatada(valor?: string, hora = false) {
  if (!valor || !Number.isFinite(Date.parse(valor))) return 'Sem data definida';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    ...(!hora ? { timeZone: 'UTC' } : {}),
    ...(hora ? ({ hour: '2-digit', minute: '2-digit' } as const) : ({ year: 'numeric' } as const)),
  }).format(new Date(valor));
}
export const temSessao = () => Boolean(tokenDaSessao()) || headersDeTesteNoCliente();
export function podeEscrever(secao?: Secao) {
  const papel = perfilLogado()?.papel ?? (headersDeTesteNoCliente() ? 'vendedor' : '');
  return secao === 'produtos'
    ? ['admin', 'gestor'].includes(papel)
    : ['admin', 'gestor', 'vendedor'].includes(papel);
}
export class ErroComercial extends Error {
  constructor(
    mensagem: string,
    public status = 0,
  ) {
    super(mensagem);
  }
}
export async function apiComercial<T>(
  caminho: string,
  metodo = 'GET',
  corpo?: unknown,
): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(urlDaApi(`/v1/comercial${caminho}`), {
      method: metodo,
      headers: cabecalhosDaSessao(),
      ...(corpo !== undefined ? { body: JSON.stringify(corpo) } : {}),
    });
  } catch {
    throw new ErroComercial(
      'Sem conexão com a carteira. A alteração não foi confirmada. Você pode continuar capturando contatos neste aparelho.',
    );
  }
  let json: { erros?: { mensagem?: string }[]; message?: string };
  try {
    json = await resposta.json();
  } catch {
    throw new ErroComercial(
      'A API não respondeu como esperado. Confira sua conexão e tente novamente.',
      resposta.status,
    );
  }
  if (!resposta.ok)
    throw new ErroComercial(
      resposta.status === 403 || resposta.status === 401
        ? 'Sua sessão não permite esta ação ou expirou. Entre novamente para continuar.'
        : (json.erros?.[0]?.mensagem ?? json.message ?? 'Não foi possível concluir esta ação.'),
      resposta.status,
    );
  return json as T;
}
export function useComercial<T>(caminho: string | null) {
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [revisao, setRevisao] = useState(0);
  useEffect(() => {
    const atualizar = () => setRevisao((n) => n + 1);
    window.addEventListener('tela-viva-sessao', atualizar);
    return () => window.removeEventListener('tela-viva-sessao', atualizar);
  }, []);
  useEffect(() => {
    let vivo = true;
    setDados(null);
    setErro('');
    if (!caminho || !temSessao()) {
      setCarregando(false);
      return;
    }
    setCarregando(true);
    void apiComercial<T>(caminho)
      .then((valor) => {
        if (vivo) setDados(valor);
      })
      .catch((e: unknown) => {
        if (vivo) setErro(e instanceof Error ? e.message : 'Não consegui carregar os registros.');
      })
      .finally(() => {
        if (vivo) setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, [caminho, revisao]);
  return { dados, erro, carregando, atualizar: () => setRevisao((n) => n + 1) };
}
export async function todasReferencias(secao: Secao): Promise<Registro[]> {
  const registros: Registro[] = [];
  let pagina = 1;
  while (true) {
    const lista = await apiComercial<Lista>(`/${secao}?limite=100&pagina=${pagina}`);
    registros.push(...lista.registros);
    if (registros.length >= lista.total || !lista.registros.length) return registros;
    pagina += 1;
  }
}

export function contatoDaProposta(proposta: Registro, conta?: Registro) {
  if (!conta) return null;
  const pessoasAtivas = (conta.pessoas ?? []).filter((p) => p.ativo);
  if (proposta.contatoId) return pessoasAtivas.find((p) => p.id === proposta.contatoId) ?? null;
  return (
    pessoasAtivas.find((p) => p.principal) ??
    (conta.contatoNome || conta.contatoEmail
      ? {
          nome: conta.contatoNome ?? '',
          email: conta.contatoEmail ?? '',
          cargo: '',
          telefone: conta.contatoTelefone ?? '',
        }
      : null)
  );
}

export function rascunhoEmailProposta(proposta: Registro, conta?: Registro) {
  const contato = contatoDaProposta(proposta, conta);
  if (!contato?.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contato.email)) return null;
  const corpo = [
    `Olá${contato.nome ? `, ${contato.nome}` : ''}.`,
    '',
    `Segue o resumo da proposta ${nomeRegistro(proposta)}${conta?.nome ? ` para ${conta.nome}` : ''}.`,
    '',
    ...(proposta.itens ?? []).map(
      (i) =>
        `${i.quantidade} × ${i.descricao}: ${moeda(i.quantidade * i.precoUnitarioCentavos - Math.round((i.quantidade * i.precoUnitarioCentavos * i.descontoPercentual) / 100))}`,
    ),
    '',
    `Total: ${moeda(proposta.totalCentavos)}`,
    `Validade: ${dataFormatada(proposta.validade)}`,
    ...(proposta.condicoesPagamento ? [`Condições: ${proposta.condicoesPagamento}`] : []),
    ...(proposta.observacoes ? ['', proposta.observacoes] : []),
    '',
    'Tela Viva — Cuidados para Pele Tatuada',
    'JSETTE7 Comércio de Produtos Médicos e Hospitalares LTDA',
    'CNPJ 54.765.439/0001-34',
  ].join('\n');
  return `mailto:${encodeURIComponent(contato.email)}?subject=${encodeURIComponent(`Proposta comercial · ${nomeRegistro(proposta)}`)}&body=${encodeURIComponent(corpo)}`;
}

export function papelUsuario(papel?: string) {
  return (
    (
      {
        vendedor: 'Representante',
        gestor: 'Gestor',
        admin: 'Administrador',
        auditor: 'Auditor',
      } as Record<string, string>
    )[papel ?? ''] ?? 'Equipe'
  );
}
export function descricaoUsuario(equipe: UsuarioComercial[], id?: string) {
  if (!id) return 'Não definido';
  const pessoa = equipe.find((u) => u.id === id);
  return pessoa
    ? `${pessoa.nome} · ${papelUsuario(pessoa.papel)}`
    : 'Pessoa atribuída (nome indisponível)';
}
export async function carregarEquipe(): Promise<UsuarioComercial[]> {
  let resposta: Response;
  try {
    resposta = await fetch(urlDaApi('/v1/usuarios/equipe'), { headers: cabecalhosDaSessao() });
  } catch {
    throw new Error(
      'Sem conexão para consultar a equipe. As atribuições existentes serão preservadas.',
    );
  }
  if (!resposta.ok)
    throw new Error(
      'Não foi possível consultar a equipe ativa com esta sessão. Revise o acesso ou tente novamente.',
    );
  const json = (await resposta.json()) as { dados?: UsuarioComercial[] };
  if (!Array.isArray(json.dados))
    throw new Error('A equipe não foi carregada. Tente novamente antes de alterar a atribuição.');
  return json.dados.filter(
    (u) => u.ativo !== false && typeof u.id === 'string' && typeof u.nome === 'string',
  );
}
export function useEquipe(ativa: boolean) {
  const [equipe, setEquipe] = useState<UsuarioComercial[]>([]);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [revisao, setRevisao] = useState(0);
  useEffect(() => {
    let vivo = true;
    setErro('');
    setEquipe([]);
    if (!ativa || !temSessao()) {
      setCarregando(false);
      return;
    }
    setCarregando(true);
    void carregarEquipe()
      .then((dados) => {
        if (vivo) setEquipe(dados);
      })
      .catch((e: unknown) => {
        if (vivo) setErro(e instanceof Error ? e.message : 'Não consegui carregar a equipe.');
      })
      .finally(() => {
        if (vivo) setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, [ativa, revisao]);
  return { equipe, erro, carregando, atualizar: () => setRevisao((n) => n + 1) };
}
