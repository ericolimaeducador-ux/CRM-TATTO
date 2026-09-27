import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { RespostaComErro } from '../contatos/erros-http';
import { cifrar, decifrar } from '../seguranca/cifra';
import {
  codigosCoincidem,
  codigoNoPasso,
  gerarSegredoBase32,
  passosNaJanela,
} from './totp-rfc6238';

export interface InscricaoTotp {
  segredoBase32: string;
  otpauth: string;
  pendente: true;
}

export interface OpcoesInscricao {
  codigoAtual?: string;
  stepUp?: boolean;
}

export type ContextoTotp = 'login' | 'passo' | 'promocao';

export interface VereditoTotp {
  aceito: boolean;
  codigo: 'OK' | 'STEP_UP_NECESSARIO' | 'CODIGO_TOTP_REUSADO';
  mensagem: string;
}

interface DocumentoTotp {
  usuarioId: string;
  segredoCifrado?: string;
  segredoPendenteCifrado?: string;
  ultimoPassoAceito: number | null;
}

const FRASES: Record<
  ContextoTotp,
  Record<'formato' | 'ausente' | 'invalido' | 'reusado', string>
> = {
  login: {
    formato: 'Para entrar, informe o código de 6 dígitos do autenticador. Nada foi aberto.',
    ausente: 'Este usuário ainda não ativou o autenticador. Nada foi aberto.',
    invalido: 'O código não confere. Gere outro e tente entrar de novo. Nada foi aberto.',
    reusado: 'Esse código já foi usado. Espere o próximo do autenticador. Nada foi aberto.',
  },
  passo: {
    formato: 'Informe o código de 6 dígitos do autenticador. Nada foi alterado.',
    ausente: 'Este usuário ainda não ativou o autenticador. Nada foi alterado.',
    invalido:
      'O código não confere nesta janela de 30 segundos. Gere outro e tente de novo. Nada foi alterado.',
    reusado: 'Esse código já foi usado. Espere o próximo do autenticador. Nada foi repetido.',
  },
  promocao: {
    formato:
      'Promover a cliente pede o código de 6 dígitos do autenticador. A captura não pede isso.',
    ausente:
      'Este usuário ainda não inscreveu o autenticador. Inscreva e tente a promoção de novo. O contato não mudou.',
    invalido:
      'O código não confere nesta janela de 30 segundos, com um passo de tolerância para cada lado. Gere outro e tente a promoção de novo.',
    reusado:
      'Esse código já foi usado. Espere o próximo do autenticador. A promoção não foi repetida.',
  },
};

@Injectable()
export class TotpService {
  constructor(@InjectModel('UsuarioTotp') private readonly usuarios: Model<DocumentoTotp>) {}

  async inscrever(usuarioId: string, opcoes: OpcoesInscricao = {}): Promise<InscricaoTotp> {
    const existente = await this.usuarios.findOne({ usuarioId }).lean<DocumentoTotp | null>();
    if (segredoAtivo(existente)) {
      const veredito = await this.confirmar(
        usuarioId,
        opcoes.codigoAtual ?? '',
        Date.now(),
        'passo',
      );
      if (!veredito.aceito) {
        throw new RespostaComErro(
          403,
          veredito.codigo,
          veredito.codigo === 'CODIGO_TOTP_REUSADO'
            ? veredito.mensagem
            : 'Para trocar o autenticador, informe o código atual de 6 dígitos. O segredo anterior continua valendo.',
          null,
        );
      }
    }
    const segredoBase32 = gerarSegredoBase32();
    await this.usuarios.findOneAndUpdate(
      { usuarioId },
      { $set: { usuarioId, segredoPendenteCifrado: cifrar(segredoBase32) } },
      { upsert: true },
    );
    return {
      segredoBase32,
      pendente: true,
      otpauth: `otpauth://totp/captura7:${usuarioId}?secret=${segredoBase32}&issuer=captura7&digits=6&period=30`,
    };
  }

  async ativar(usuarioId: string, codigoInformado: string, agoraMs = Date.now()) {
    const doc = await this.usuarios.findOne({ usuarioId }).lean<DocumentoTotp | null>();
    if (!doc?.segredoPendenteCifrado) {
      throw new RespostaComErro(
        422,
        'TOTP_SEM_PENDENTE',
        'Não há segredo pendente. Gere a inscrição de novo e confirme o código. Nada foi ativado.',
        null,
      );
    }
    const informado = codigoInformado.trim();
    if (!/^\d{6}$/.test(informado)) {
      throw new RespostaComErro(
        403,
        'STEP_UP_NECESSARIO',
        'Para ativar o autenticador, informe o código de 6 dígitos do segredo pendente. O segredo ativo, se existir, não mudou.',
        null,
      );
    }
    const segredo = decifrar(doc.segredoPendenteCifrado);
    const passo = passosNaJanela(agoraMs).find((candidato) =>
      codigosCoincidem(informado, codigoNoPasso(segredo, candidato)),
    );
    if (passo === undefined) {
      throw new RespostaComErro(
        403,
        'STEP_UP_NECESSARIO',
        'O código não confere com o segredo pendente. O autenticador não foi ativado.',
        null,
      );
    }
    await this.usuarios.updateOne(
      { usuarioId },
      {
        $set: { segredoCifrado: doc.segredoPendenteCifrado, ultimoPassoAceito: passo },
        $unset: { segredoPendenteCifrado: '' },
      },
    );
    return { ativado: true };
  }

  async zerar(usuarioId: string): Promise<void> {
    await this.usuarios.deleteOne({ usuarioId });
  }

  async inscrito(usuarioId: string): Promise<boolean> {
    const doc = await this.usuarios
      .findOne({ usuarioId })
      .lean<{ segredoCifrado?: string } | null>();
    return segredoAtivo(doc);
  }

  async confirmar(
    usuarioId: string,
    codigoInformado: string,
    agoraMs = Date.now(),
    contexto: ContextoTotp = 'passo',
  ): Promise<VereditoTotp> {
    const frases = FRASES[contexto];
    const informado = codigoInformado.trim();
    if (!/^\d{6}$/.test(informado)) {
      return { aceito: false, codigo: 'STEP_UP_NECESSARIO', mensagem: frases.formato };
    }
    const doc = await this.usuarios.findOne({ usuarioId }).lean<DocumentoTotp | null>();
    if (!segredoAtivo(doc)) {
      return { aceito: false, codigo: 'STEP_UP_NECESSARIO', mensagem: frases.ausente };
    }
    const segredo = decifrar(String(doc?.segredoCifrado));
    const passo = passosNaJanela(agoraMs).find((candidato) =>
      codigosCoincidem(informado, codigoNoPasso(segredo, candidato)),
    );
    if (passo === undefined) {
      return { aceito: false, codigo: 'STEP_UP_NECESSARIO', mensagem: frases.invalido };
    }
    const atualizado = await this.usuarios.findOneAndUpdate(
      {
        usuarioId,
        $or: [{ ultimoPassoAceito: null }, { ultimoPassoAceito: { $lt: passo } }],
      },
      { $set: { ultimoPassoAceito: passo } },
    );
    if (!atualizado) {
      return { aceito: false, codigo: 'CODIGO_TOTP_REUSADO', mensagem: frases.reusado };
    }
    return { aceito: true, codigo: 'OK', mensagem: 'Código aceito.' };
  }
}

function segredoAtivo(doc: { segredoCifrado?: string } | null | undefined): boolean {
  return typeof doc?.segredoCifrado === 'string' && doc.segredoCifrado.length > 0;
}
