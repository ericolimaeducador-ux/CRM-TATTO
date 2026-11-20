import { RespostaComErro } from '../contatos/erros-http';
import { ETAPAS, TIPOS, type TipoComercial } from './comercial.schema';
import { randomUUID } from 'node:crypto';

export function falha(mensagem: string, codigo = 'COMERCIAL_INVALIDO', status = 422): never {
  throw new RespostaComErro(status, codigo, mensagem, null);
}
export function tipoValido(valor: string): TipoComercial {
  if (!(TIPOS as readonly string[]).includes(valor))
    falha('Esta seção não existe.', 'SECAO_AUSENTE', 404);
  return valor as TipoComercial;
}
const TEXTOS: Record<TipoComercial, string[]> = {
  contas: [
    'nome',
    'cidade',
    'uf',
    'especialidade',
    'territorio',
    'contatoNome',
    'contatoEmail',
    'contatoTelefone',
    'endereco',
    'proximaAcao',
    'observacoes',
  ],
  produtos: ['nome', 'fabricante', 'linha', 'unidade', 'codigo', 'descricao', 'observacoes'],
  oportunidades: ['titulo', 'proximaAcao', 'observacoes', 'motivoPerda'],
  atividades: ['titulo', 'resultado', 'proximaAcao', 'observacoes', 'local', 'realizacao'],
  propostas: ['titulo', 'observacoes', 'condicoesPagamento'],
  precosCliente: ['motivo', 'motivoFechamento'],
  treinamentos: [
    'titulo',
    'linkAcesso',
    'grupoGenerico',
    'marca',
    'motivoTreinamento',
    'descricao',
  ],
  participantes: ['nome', 'cargo', 'email', 'telefone', 'origem'],
};
const ENUMS: Record<TipoComercial, Record<string, string[]>> = {
  contas: {
    segmento: [
      'estudio_tatuagem',
      'profissional_autonomo',
      'hospital',
      'clinica',
      'farmacia',
      'laboratorio',
      'distribuidor',
      'consultorio',
      'outro',
    ],
    classificacao: ['A', 'B', 'C'],
    status: ['prospect', 'ativo', 'inativo'],
  },
  produtos: {
    categoria: [
      'cosmetico',
      'kit',
      'medicamento',
      'dispositivo',
      'material',
      'equipamento',
      'outro',
    ],
  },
  oportunidades: { etapa: ETAPAS },
  atividades: {
    tipo: ['visita', 'ligacao', 'email', 'reuniao', 'tarefa'],
    status: ['planejada', 'concluida', 'cancelada'],
    canal: ['presencial', 'remoto'],
  },
  propostas: { status: ['rascunho', 'apresentada', 'aceita', 'recusada'] },
  precosCliente: {
    status: ['solicitado', 'aguardando_aprovacao', 'aprovado', 'reprovado', 'ganho', 'perdido'],
  },
  treinamentos: {
    tipo: ['online', 'presencial'],
    status: ['planejado', 'em_andamento', 'concluido', 'cancelado'],
  },
  participantes: { status: ['inscrito', 'confirmado', 'presente', 'ausente', 'cancelado'] },
};
export const PADROES: Record<TipoComercial, Record<string, unknown>> = {
  contas: {
    nome: '',
    segmento: 'outro',
    classificacao: 'B',
    status: 'prospect',
    frequenciaVisitaDias: 30,
  },
  produtos: { nome: '', categoria: 'outro', unidade: 'unidade', precoCentavos: 0 },
  oportunidades: { titulo: '', etapa: 'prospeccao', valorCentavos: 0, probabilidade: 10 },
  atividades: { titulo: '', tipo: 'visita', status: 'planejada', canal: 'presencial' },
  propostas: { titulo: '', status: 'rascunho', itens: [] },
  precosCliente: { precoCentavos: 0, status: 'solicitado' },
  treinamentos: { titulo: '', tipo: 'presencial', status: 'planejado' },
  participantes: { nome: '', status: 'inscrito', confirmado: false, presente: false },
};
const NUMEROS: Record<TipoComercial, Record<string, [number, number]>> = {
  contas: { frequenciaVisitaDias: [1, 730] },
  produtos: { precoCentavos: [0, 1_000_000_000] },
  oportunidades: { valorCentavos: [0, 100_000_000_000], probabilidade: [0, 100] },
  atividades: {},
  propostas: {},
  precosCliente: { precoCentavos: [0, 1_000_000_000], precoReferenciaCentavos: [0, 1_000_000_000] },
  treinamentos: {},
  participantes: {},
};
const DATAS: Record<TipoComercial, string[]> = {
  contas: ['proximaVisita'],
  produtos: [],
  oportunidades: ['previsao'],
  atividades: ['data'],
  propostas: ['validade'],
  precosCliente: ['validade'],
  treinamentos: ['dataInicio', 'dataFim'],
  participantes: [],
};
export function sanitizar(
  tipo: TipoComercial,
  corpo: Record<string, unknown>,
): Record<string, unknown> {
  const campos: Record<string, unknown> = {};
  for (const campo of TEXTOS[tipo]) {
    if (!(campo in corpo)) continue;
    if (
      typeof corpo[campo] !== 'string' ||
      String(corpo[campo]).length > (campo === 'observacoes' ? 4000 : 500)
    )
      falha(`Confira o campo ${campo}. Use texto dentro do limite.`);
    campos[campo] = String(corpo[campo]).trim();
  }
  for (const [campo, opcoes] of Object.entries(ENUMS[tipo])) {
    if (!(campo in corpo)) continue;
    if (typeof corpo[campo] !== 'string' || !opcoes.includes(corpo[campo] as string))
      falha(`Escolha uma opção válida para ${campo}.`);
    campos[campo] = corpo[campo];
  }
  for (const [campo, [min, max]] of Object.entries(NUMEROS[tipo])) {
    if (!(campo in corpo)) continue;
    campos[campo] = numero(corpo[campo], min, max, campo);
  }
  for (const campo of DATAS[tipo]) {
    if (!(campo in corpo)) continue;
    const valor = corpo[campo];
    if (valor === '' || valor === null) {
      campos[campo] = null;
      continue;
    }
    if (
      typeof valor !== 'string' ||
      valor.length > 40 ||
      !/^\d{4}-\d{2}-\d{2}(T|$)/.test(valor) ||
      !Number.isFinite(Date.parse(valor))
    )
      falha(`Informe uma data válida para ${campo}.`);
    campos[campo] = new Date(valor as string).toISOString();
  }
  const refs: string[] =
    tipo === 'contas' || tipo === 'produtos'
      ? []
      : tipo === 'participantes'
        ? ['treinamentoId']
        : tipo === 'precosCliente'
          ? ['contaId', 'produtoId']
          : ['contaId', ...(tipo === 'oportunidades' ? [] : ['oportunidadeId'])];
  for (const campo of refs) {
    if (!(campo in corpo)) continue;
    if (
      typeof corpo[campo] !== 'string' ||
      (corpo[campo] !== '' && !/^[a-f\d]{24}$/i.test(corpo[campo] as string))
    )
      falha(`Escolha uma referência válida para ${campo}.`);
    campos[campo] = corpo[campo];
  }
  if ('pessoas' in corpo) {
    if (tipo !== 'contas') falha('Contatos só podem ser alterados no cadastro da conta.');
    campos.pessoas = pessoasValidas(corpo.pessoas);
  }
  if ('confirmado' in corpo || 'presente' in corpo) {
    if (tipo !== 'participantes') falha('Este estado só vale para participantes de treinamento.');
    for (const campo of ['confirmado', 'presente']) {
      if (!(campo in corpo)) continue;
      if (typeof corpo[campo] !== 'boolean') falha(`Confira ${campo}.`);
      campos[campo] = corpo[campo];
    }
  }
  if ('responsavelId' in corpo || 'colaboradoresIds' in corpo) {
    if (tipo !== 'atividades') falha('A atribuição de responsáveis só vale para atividades.');
  }
  if ('responsavelId' in corpo) campos.responsavelId = idValido(corpo.responsavelId, 'responsável');
  if ('colaboradoresIds' in corpo) {
    if (!Array.isArray(corpo.colaboradoresIds) || corpo.colaboradoresIds.length > 20)
      falha('Informe até 20 colaboradores.');
    campos.colaboradoresIds = [
      ...new Set(corpo.colaboradoresIds.map((id) => idValido(id, 'colaborador'))),
    ];
  }
  if ('contatoId' in corpo) {
    if (
      tipo !== 'propostas' ||
      typeof corpo.contatoId !== 'string' ||
      !/^[\da-f-]{36}$/i.test(corpo.contatoId)
    )
      falha('Escolha um contato válido da conta.');
    campos.contatoId = corpo.contatoId;
  }
  if (tipo === 'precosCliente') {
    for (const campo of ['precoCentavos', 'precoReferenciaCentavos']) {
      if (campo in campos) numero(campos[campo], 0, 1_000_000_000, campo);
    }
  }
  if (
    tipo === 'treinamentos' &&
    campos.dataInicio &&
    campos.dataFim &&
    Date.parse(String(campos.dataFim)) < Date.parse(String(campos.dataInicio))
  )
    falha('O fim do treinamento precisa ser posterior ao início.');
  if (tipo === 'participantes' && 'email' in campos) {
    const email = String(campos.email).trim().toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      falha('Informe um e-mail válido para o participante.');
    campos.email = email;
  }
  if (tipo === 'treinamentos' && 'dataInicio' in campos && !campos.dataInicio)
    falha('Informe a data inicial do treinamento.');
  if (tipo === 'propostas' && 'itens' in corpo) campos.itens = itensValidos(corpo.itens);
  if ('uf' in campos && campos.uf) {
    campos.uf = String(campos.uf).toUpperCase();
    if (!/^[A-Z]{2}$/.test(campos.uf as string)) falha('Informe a UF com duas letras.');
  }
  return campos;
}
function idValido(valor: unknown, campo: string): string {
  if (typeof valor !== 'string' || !/^[a-f\d]{24}$/i.test(valor))
    falha(`Escolha um ${campo} válido.`);
  return valor;
}
function pessoasValidas(valor: unknown) {
  if (!Array.isArray(valor) || valor.length > 100) falha('A conta aceita até 100 contatos.');
  const pessoas = (valor as unknown[]).map((linha) => {
    if (!linha || typeof linha !== 'object' || Array.isArray(linha))
      falha('Confira os contatos da conta.');
    const pessoa = linha as Record<string, unknown>;
    const texto = (chave: string, limite: number) => {
      const item = pessoa[chave] ?? '';
      if (typeof item !== 'string' || item.length > limite) falha(`Confira ${chave} do contato.`);
      return item.trim();
    };
    const email = texto('email', 254).toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      falha('Informe um e-mail válido para o contato.');
    if (pessoa.principal !== undefined && typeof pessoa.principal !== 'boolean')
      falha('Confira o contato principal.');
    if (pessoa.ativo !== undefined && typeof pessoa.ativo !== 'boolean')
      falha('Confira o estado do contato.');
    const id = pessoa.id === undefined ? randomUUID() : texto('id', 36);
    if (!/^[\da-f-]{36}$/i.test(id)) falha('O identificador do contato é inválido.');
    return {
      id,
      nome: texto('nome', 160),
      cargo: texto('cargo', 120),
      email,
      telefone: texto('telefone', 40),
      principal: pessoa.principal === true,
      ativo: pessoa.ativo !== false,
      observacoes: texto('observacoes', 1000),
    };
  });
  if (pessoas.filter((p) => p.principal && p.ativo).length > 1)
    falha('Marque apenas um contato ativo como principal.');
  return pessoas;
}
function numero(valor: unknown, min: number, max: number, campo: string, inteiro = true): number {
  if (
    typeof valor !== 'number' ||
    !Number.isFinite(valor) ||
    (inteiro && !Number.isSafeInteger(valor)) ||
    valor < min ||
    valor > max
  )
    falha(`Confira ${campo}: valor entre ${min} e ${max}${inteiro ? ', inteiro' : ''}.`);
  return valor as number;
}
function itensValidos(valor: unknown) {
  if (!Array.isArray(valor) || valor.length > 100) falha('A proposta aceita até 100 itens.');
  return (valor as unknown[]).map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item))
      falha('Confira os itens da proposta.');
    const linha = item as Record<string, unknown>;
    const produtoId = linha.produtoId ?? '';
    if (typeof produtoId !== 'string' || (produtoId !== '' && !/^[a-f\d]{24}$/i.test(produtoId)))
      falha('Escolha um produto válido.');
    if (typeof linha.descricao !== 'string' || linha.descricao.length > 500)
      falha('Informe uma descrição de até 500 caracteres.');
    return {
      produtoId,
      descricao: (linha.descricao as string).trim(),
      quantidade: numero(linha.quantidade, 1, 1_000_000, 'quantidade'),
      precoUnitarioCentavos: numero(
        linha.precoUnitarioCentavos,
        0,
        1_000_000_000,
        'preço unitário',
      ),
      descontoPercentual: numero(linha.descontoPercentual ?? 0, 0, 100, 'desconto', false),
    };
  });
}
export function totalizar(campos: Record<string, unknown>): void {
  const itens = (campos.itens ?? []) as {
    quantidade: number;
    precoUnitarioCentavos: number;
    descontoPercentual: number;
  }[];
  let subtotal = 0;
  let desconto = 0;
  for (const item of itens) {
    const bruto = item.quantidade * item.precoUnitarioCentavos;
    subtotal += bruto;
    desconto += Math.round((bruto * item.descontoPercentual) / 100);
  }
  if (!Number.isSafeInteger(subtotal) || subtotal > 100_000_000_000)
    falha('O total da proposta excede o limite permitido.');
  campos.subtotalCentavos = subtotal;
  campos.descontoCentavos = desconto;
  campos.totalCentavos = subtotal - desconto;
}
