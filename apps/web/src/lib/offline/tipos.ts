export type EstadoSync = 'local' | 'enviando' | 'sincronizado' | 'preso' | 'conflito';

export interface ContatoLocal {
  idLocal: string;
  idServidor?: string;
  versaoServidor?: number;
  campos: Record<string, string>;
  modo: string;
  payloadBruto?: string;
  estado: EstadoSync;
  tentativas: number;
  atualizadoEm: number;
  consentimento?: {
    contatoComercial: boolean;
    emDispositivo: string;
    envioErp?: boolean;
    estado: 'local' | 'enviado';
  };
  conflito?: {
    campo: string;
    valorLocal: string;
    valorServidor: Record<string, unknown>;
  };
  avisos?: { campo: string; codigo: string; mensagem: string }[];
  mensagem?: string;
}

export interface Operacao {
  id: string;
  idLocal: string;
  tipo: 'criar' | 'patch';
  campo?: string;
  valor?: string;
  tentativas: number;
  proximaEm: number;
}

export interface RespostaEscrita {
  http: number;
  dados?: Record<string, unknown>;
  avisos?: { campo: string; codigo: string; mensagem: string }[];
  erros?: { codigo: string; mensagem: string }[];
}
