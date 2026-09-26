import { SetMetadata } from '@nestjs/common';

export const CHAVE_PAPEIS = 'papeis';
export const CHAVE_PUBLICO = 'publico';
export const CHAVE_STEP_UP = 'step_up';

export const Papel = (...papeis: string[]) => SetMetadata(CHAVE_PAPEIS, papeis);
export const Publico = () => SetMetadata(CHAVE_PUBLICO, true);
export const ExigeStepUp = () => SetMetadata(CHAVE_STEP_UP, true);
