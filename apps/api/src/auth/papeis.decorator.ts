import { SetMetadata } from '@nestjs/common';

export const CHAVE_PAPEIS = 'papeis';
export const CHAVE_PUBLICO = 'publico';
export const CHAVE_STEP_UP = 'step_up';
export const CHAVE_SEM_TOTP = 'sem_totp';
export const CHAVE_SENHA_PROVISORIA = 'senha_provisoria';

export const Papel = (...papeis: string[]) => SetMetadata(CHAVE_PAPEIS, papeis);
export const Publico = () => SetMetadata(CHAVE_PUBLICO, true);
export const ExigeStepUp = () => SetMetadata(CHAVE_STEP_UP, true);
export const SemTotp = () => SetMetadata(CHAVE_SEM_TOTP, true);
/** Rota liberada mesmo com a senha provisória ainda não trocada (trocar senha, sair, eu). */
export const PermiteSenhaProvisoria = () => SetMetadata(CHAVE_SENHA_PROVISORIA, true);
