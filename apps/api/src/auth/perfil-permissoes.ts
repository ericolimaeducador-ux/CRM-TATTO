export const PAPEIS = ['vendedor', 'gestor', 'admin', 'auditor'] as const;
export type PapelUsuario = (typeof PAPEIS)[number];

export const PERFIL_PERMISSOES = {
  criar_contato: ['vendedor', 'gestor', 'admin'],
  ler_contato: ['vendedor', 'gestor', 'admin', 'auditor'],
  editar_contato: ['vendedor', 'gestor', 'admin'],
  ler_auditoria: ['gestor', 'admin', 'auditor'],
  transicionar_qualificado: ['gestor', 'admin'],
  transicionar_cliente: ['gestor', 'admin'],
  fundir: ['gestor', 'admin'],
  exportar: ['gestor', 'admin'],
  gerenciar_usuarios: ['admin'],
} as const;

export type Acao = keyof typeof PERFIL_PERMISSOES;

export const ACOES_STEP_UP = [
  'transicionar_cliente',
  'fundir',
  'exportar',
  'alterar_papel',
] as const;

export function exigeStepUp(acao: string): boolean {
  return (ACOES_STEP_UP as readonly string[]).includes(acao);
}

export function papeisDaAcao(acao: Acao): readonly string[] {
  return PERFIL_PERMISSOES[acao];
}

export function podeEscrever(papel: string): boolean {
  return papel === 'vendedor' || papel === 'gestor' || papel === 'admin';
}

export function podeAcessarCarteira(
  papel: string,
  usuarioId: string,
  vendedorAtribuido: string | undefined,
  acao: 'ler_contato' | 'editar_contato',
): boolean {
  if (acao === 'editar_contato' && !podeEscrever(papel)) return false;
  if (papel === 'gestor' || papel === 'admin' || (papel === 'auditor' && acao === 'ler_contato')) {
    return true;
  }
  if (papel === 'vendedor') return Boolean(vendedorAtribuido) && usuarioId === vendedorAtribuido;
  return false;
}
