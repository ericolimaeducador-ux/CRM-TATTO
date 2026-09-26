export interface BaseLegalDerivada {
  baseLegal: 'consentimento' | 'legitimo_interesse' | 'execucao_contrato';
  finalidade: string[];
  canalColeta: string;
}

export function baseLegalPorModo(modo: string | undefined): BaseLegalDerivada {
  return {
    baseLegal: 'legitimo_interesse',
    finalidade: ['prospecção comercial B2B'],
    canalColeta: modo && modo.length > 0 ? modo : 'manual',
  };
}
