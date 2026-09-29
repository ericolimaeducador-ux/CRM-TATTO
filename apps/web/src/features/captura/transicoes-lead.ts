/**
 * Espelho da máquina de status da API (apps/api/src/contatos/transicao.service.ts):
 * rascunho → capturado → qualificado → cliente, descartar de qualquer status ativo e
 * reabrir um descartado como rascunho ou capturado.
 */
export interface AcaoDeStatus {
  para: 'capturado' | 'qualificado' | 'descartado' | 'rascunho';
  rotulo: string;
}

export function acoesDeStatus(status: string | undefined): AcaoDeStatus[] {
  switch (status) {
    case 'rascunho':
      return [{ para: 'capturado', rotulo: 'Marcar como capturado' }];
    case 'capturado':
      return [{ para: 'qualificado', rotulo: 'Qualificar' }];
    case 'descartado':
      return [
        { para: 'rascunho', rotulo: 'Reabrir como rascunho' },
        { para: 'capturado', rotulo: 'Reabrir como capturado' },
      ];
    default:
      return [];
  }
}

export function podeDescartar(status: string | undefined): boolean {
  return Boolean(status) && status !== 'descartado';
}

export function podePromover(status: string | undefined): boolean {
  return status === 'qualificado';
}

const NOMES: Record<string, string> = {
  rascunho: 'rascunho',
  capturado: 'capturado',
  qualificado: 'qualificado',
  cliente: 'cliente',
  descartado: 'descartado',
};

export function nomeDoStatus(status: string | undefined): string {
  return (status && NOMES[status]) || '…';
}

const ORIGENS: Record<string, string> = {
  qr_proprio: 'Autocadastro pelo QR',
  qr_lido: 'QR lido pelo vendedor',
  manual: 'Digitado',
  google_forms: 'Formulário',
  importacao: 'Importação',
  importado: 'Importação',
};

export function nomeDaOrigem(modo: string | undefined): string {
  return (modo && ORIGENS[modo]) || 'Não informada';
}
