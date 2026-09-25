import { aviso, type Aviso } from '../normalizacao/avisos';
import {
  normalizarCep,
  normalizarCnpj,
  normalizarCpf,
  normalizarEmail,
  normalizarNome,
  normalizarTelefone,
} from '../normalizacao/normalizar';
import { cifrar, hmacDocumento, mascararCnpj, mascararCpf } from '../seguranca/cifra';
import type { CriarContatoDto } from './criar-contato.dto';

const MODOS = new Set(['qr_lido', 'qr_proprio', 'manual', 'google_forms', 'importacao']);
const TIPOS = new Set(['PF', 'PJ', 'INDEFINIDO']);

export interface DocumentoMontado {
  doc: Record<string, unknown>;
  avisos: Aviso[];
  cpfPuro?: string;
  cnpjPuro?: string;
  documentoValido: boolean;
}

export interface PatchMontado {
  set: Record<string, unknown>;
  unset: Record<string, ''>;
  avisos: Aviso[];
  documentoValido: boolean;
}

export function montarCriacao(corpo: CriarContatoDto): DocumentoMontado {
  const avisos = [...(corpo.avisosEstrutura ?? [])];
  const doc: Record<string, unknown> = { tipoPessoa: 'INDEFINIDO', status: 'rascunho' };
  if (corpo.idLocal?.trim()) doc.idLocal = corpo.idLocal.trim();
  if (typeof corpo.nome === 'string') doc.nome = normalizarNome(corpo.nome);
  if (typeof corpo.nomeSocial === 'string') doc.nomeSocial = corpo.nomeSocial.trim();
  if (typeof corpo.observacoes === 'string') doc.observacoes = corpo.observacoes;
  if (typeof corpo.tipoPessoa === 'string') {
    if (TIPOS.has(corpo.tipoPessoa)) doc.tipoPessoa = corpo.tipoPessoa;
    else
      avisos.push(
        aviso('tipoPessoa', 'TIPO_INVALIDO', 'Tipo de pessoa desconhecido. Mantivemos indefinido.'),
      );
  }
  aplicarEmail(doc, corpo.email, avisos);
  aplicarTelefone(doc, corpo.telefone, avisos);
  aplicarEndereco(doc, corpo, avisos);
  const cpf = aplicarCpf(doc, corpo.cpf, avisos);
  const cnpj = aplicarCnpj(doc, corpo.cnpj, avisos);
  if (typeof corpo.razaoSocial === 'string') {
    doc.pj = { ...((doc.pj as object) ?? {}), razaoSocial: normalizarNome(corpo.razaoSocial) };
  }
  if (typeof corpo.nomeFantasia === 'string') {
    doc.pj = { ...((doc.pj as object) ?? {}), nomeFantasia: corpo.nomeFantasia.trim() };
  }
  const modo = corpo.origem?.modo;
  doc.origem = {
    modo: modo && MODOS.has(modo) ? modo : 'manual',
    ...(corpo.origem?.payloadBruto ? { payloadBruto: corpo.origem.payloadBruto } : {}),
  };
  if (modo && !MODOS.has(modo)) {
    avisos.push(
      aviso('origem.modo', 'MODO_INVALIDO', 'Modo de entrada desconhecido. Gravamos como manual.'),
    );
  }
  return {
    doc,
    avisos,
    cpfPuro: cpf.puro,
    cnpjPuro: cnpj.puro,
    documentoValido: cpf.valido || cnpj.valido,
  };
}

export function montarPatch(
  antes: Record<string, unknown>,
  campo: string | undefined,
  valor: unknown,
): PatchMontado {
  const avisos: Aviso[] = [];
  const set: Record<string, unknown> = {};
  const unset: Record<string, ''> = {};
  if (!campo) {
    avisos.push(
      aviso('campo', 'CAMPO_AUSENTE', 'O autosave envia um campo por vez. Nada foi alterado.'),
    );
    return { set, unset, avisos, documentoValido: documentoJaValido(antes) };
  }
  const texto = typeof valor === 'string' ? valor : undefined;
  if (typeof valor !== 'string' && valor != null) {
    avisos.push(
      aviso(
        campo,
        'FORMATO_INVALIDO',
        'Este valor não é texto. O campo ficou como estava e o contato continua salvo.',
      ),
    );
    return { set, unset, avisos, documentoValido: documentoJaValido(antes) };
  }
  if (campo === 'nome' && texto !== undefined) set.nome = normalizarNome(texto);
  else if (campo === 'nomeSocial' && texto !== undefined) set.nomeSocial = texto.trim();
  else if (campo === 'observacoes' && texto !== undefined) set.observacoes = texto;
  else if (campo === 'tipoPessoa' && texto !== undefined) {
    if (TIPOS.has(texto)) set.tipoPessoa = texto;
    else
      avisos.push(
        aviso(
          'tipoPessoa',
          'TIPO_INVALIDO',
          'Tipo de pessoa desconhecido. O valor anterior permanece.',
        ),
      );
  } else if (campo === 'email') aplicarEmail(set, texto, avisos);
  else if (campo === 'telefone') aplicarTelefone(set, texto, avisos);
  else if (campo === 'cpf') aplicarCpf(set, texto, avisos);
  else if (campo === 'cnpj') aplicarCnpj(set, texto, avisos);
  else if (campo === 'razaoSocial' && texto !== undefined) {
    set['pj.razaoSocial'] = normalizarNome(texto);
  } else if (campo === 'nomeFantasia' && texto !== undefined) set['pj.nomeFantasia'] = texto.trim();
  else if (campo === 'payloadBruto' && texto !== undefined) set['origem.payloadBruto'] = texto;
  else if (
    ['cep', 'logradouro', 'numero', 'cidade', 'uf', 'complemento', 'bairro'].includes(campo)
  ) {
    aplicarPedaçoEndereco(set, antes, campo, texto ?? '', avisos);
  } else {
    avisos.push(
      aviso(
        campo,
        'CAMPO_IGNORADO',
        'Este campo não entra pelo autosave. O restante do contato continua salvo.',
      ),
    );
  }
  const vista = { ...antes, ...set };
  const documentoValido =
    Boolean(
      (set['pf.cpfHash'] as string | undefined) ||
      (antes.pf as { cpfHash?: string } | undefined)?.cpfHash,
    ) ||
    Boolean(
      (set['pj.cnpjHash'] as string | undefined) ||
      (antes.pj as { cnpjHash?: string } | undefined)?.cnpjHash,
    );
  if (set['pf.cpfCifrado'] && !set['pf.cpfHash']) unset['pf.cpfHash'] = '';
  if (set['pj.cnpjCifrado'] && !set['pj.cnpjHash']) unset['pj.cnpjHash'] = '';
  return { set, unset, avisos, documentoValido: documentoValido || documentoJaValido(vista) };
}

function documentoJaValido(doc: Record<string, unknown>): boolean {
  const pf = doc.pf as { cpfHash?: string } | undefined;
  const pj = doc.pj as { cnpjHash?: string } | undefined;
  return Boolean(pf?.cpfHash || pj?.cnpjHash || doc['pf.cpfHash'] || doc['pj.cnpjHash']);
}

function aplicarEmail(
  destino: Record<string, unknown>,
  valor: string | undefined,
  avisos: Aviso[],
): void {
  if (valor === undefined) return;
  const resultado = normalizarEmail(valor);
  destino.emails = [{ valor: resultado.valor, principal: true }];
  if (resultado.aviso) avisos.push(resultado.aviso);
}

function aplicarTelefone(
  destino: Record<string, unknown>,
  valor: string | undefined,
  avisos: Aviso[],
): void {
  if (valor === undefined) return;
  const resultado = normalizarTelefone(valor);
  destino.telefones = [{ bruto: resultado.bruto, e164: resultado.e164, principal: true }];
  if (resultado.aviso) avisos.push(resultado.aviso);
}

function aplicarEndereco(
  destino: Record<string, unknown>,
  corpo: CriarContatoDto,
  avisos: Aviso[],
): void {
  const endereco: Record<string, string> = {};
  if (typeof corpo.cep === 'string') {
    const cep = normalizarCep(corpo.cep);
    endereco.cep = cep.valor;
    if (cep.aviso) avisos.push(cep.aviso);
  }
  for (const chave of ['logradouro', 'numero', 'cidade', 'uf'] as const) {
    if (typeof corpo[chave] === 'string') endereco[chave] = corpo[chave];
  }
  if (Object.keys(endereco).length > 0) destino.enderecos = [endereco];
}

function aplicarPedaçoEndereco(
  set: Record<string, unknown>,
  antes: Record<string, unknown>,
  campo: string,
  valor: string,
  avisos: Aviso[],
): void {
  const atual: Record<string, string> = Array.isArray(antes.enderecos)
    ? { ...(antes.enderecos[0] as Record<string, string>) }
    : {};
  if (campo === 'cep') {
    const cep = normalizarCep(valor);
    atual.cep = cep.valor;
    if (cep.aviso) avisos.push(cep.aviso);
  } else {
    atual[campo] = valor;
  }
  set.enderecos = [atual];
}

function aplicarCpf(
  destino: Record<string, unknown>,
  valor: string | undefined,
  avisos: Aviso[],
): { puro?: string; valido: boolean } {
  if (valor === undefined || valor.trim() === '') return { valido: false };
  const resultado = normalizarCpf(valor);
  if (resultado.aviso) avisos.push(resultado.aviso);
  const digitos = resultado.valido ? resultado.valor : valor;
  destino['pf.cpfCifrado'] = cifrar(digitos);
  if (resultado.valido) {
    destino['pf.cpfHash'] = hmacDocumento(resultado.valor);
    destino['pf.cpfMascarado'] = mascararCpf(resultado.valor);
  }
  return { puro: digitos, valido: resultado.valido };
}

function aplicarCnpj(
  destino: Record<string, unknown>,
  valor: string | undefined,
  avisos: Aviso[],
): { puro?: string; valido: boolean } {
  if (valor === undefined || valor.trim() === '') return { valido: false };
  const resultado = normalizarCnpj(valor);
  if (resultado.aviso) avisos.push(resultado.aviso);
  const digitos = resultado.valido ? resultado.valor : valor;
  destino['pj.cnpjCifrado'] = cifrar(digitos);
  if (resultado.valido) {
    destino['pj.cnpjHash'] = hmacDocumento(resultado.valor);
    destino['pj.cnpjMascarado'] = mascararCnpj(resultado.valor);
    destino['pj.cnpjRaiz'] = resultado.valor.slice(0, 8);
  }
  return { puro: digitos, valido: resultado.valido };
}
