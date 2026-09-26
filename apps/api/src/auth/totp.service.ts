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
}

export interface OpcoesInscricao {
  codigoAtual?: string;
  stepUp?: boolean;
}

export interface VereditoTotp {
  aceito: boolean;
  codigo: 'OK' | 'STEP_UP_NECESSARIO' | 'CODIGO_TOTP_REUSADO';
  mensagem: string;
}

interface DocumentoTotp {
  usuarioId: string;
  segredoCifrado: string;
  ultimoPassoAceito: number | null;
}

@Injectable()
export class TotpService {
  constructor(@InjectModel('UsuarioTotp') private readonly usuarios: Model<DocumentoTotp>) {}

  async inscrever(usuarioId: string, opcoes: OpcoesInscricao = {}): Promise<InscricaoTotp> {
    const existente = await this.usuarios.findOne({ usuarioId }).lean<DocumentoTotp | null>();
    if (existente?.segredoCifrado && opcoes.stepUp !== true) {
      const veredito = await this.confirmar(usuarioId, opcoes.codigoAtual ?? '');
      if (!veredito.aceito) {
        const mensagem =
          veredito.codigo === 'CODIGO_TOTP_REUSADO'
            ? veredito.mensagem
            : 'Para trocar o autenticador, informe o código atual de 6 dígitos. O segredo anterior continua valendo.';
        throw new RespostaComErro(403, veredito.codigo, mensagem, null);
      }
    }
    const segredoBase32 = gerarSegredoBase32();
    await this.usuarios.findOneAndUpdate(
      { usuarioId },
      { usuarioId, segredoCifrado: cifrar(segredoBase32), ultimoPassoAceito: null },
      { upsert: true, new: true },
    );
    return {
      segredoBase32,
      otpauth: `otpauth://totp/captura7:${usuarioId}?secret=${segredoBase32}&issuer=captura7&digits=6&period=30`,
    };
  }

  async zerar(usuarioId: string): Promise<void> {
    await this.usuarios.deleteOne({ usuarioId });
  }

  async confirmar(
    usuarioId: string,
    codigoInformado: string,
    agoraMs = Date.now(),
  ): Promise<VereditoTotp> {
    const informado = codigoInformado.trim();
    if (!/^\d{6}$/.test(informado)) {
      return {
        aceito: false,
        codigo: 'STEP_UP_NECESSARIO',
        mensagem:
          'Promover a cliente pede o código de 6 dígitos do autenticador. A captura não pede isso.',
      };
    }
    const doc = await this.usuarios.findOne({ usuarioId }).lean<DocumentoTotp | null>();
    if (!doc?.segredoCifrado) {
      return {
        aceito: false,
        codigo: 'STEP_UP_NECESSARIO',
        mensagem:
          'Este usuário ainda não inscreveu o autenticador. Inscreva e tente a promoção de novo. O contato não mudou.',
      };
    }
    const segredo = decifrar(doc.segredoCifrado);
    const passo = passosNaJanela(agoraMs).find((candidato) =>
      codigosCoincidem(informado, codigoNoPasso(segredo, candidato)),
    );
    if (passo === undefined) {
      return {
        aceito: false,
        codigo: 'STEP_UP_NECESSARIO',
        mensagem:
          'O código não confere nesta janela de 30 segundos, com um passo de tolerância para cada lado. Gere outro e tente de novo.',
      };
    }
    const atualizado = await this.usuarios.findOneAndUpdate(
      {
        usuarioId,
        $or: [{ ultimoPassoAceito: null }, { ultimoPassoAceito: { $lt: passo } }],
      },
      { $set: { ultimoPassoAceito: passo } },
    );
    if (!atualizado) {
      return {
        aceito: false,
        codigo: 'CODIGO_TOTP_REUSADO',
        mensagem:
          'Esse código já foi usado. Espere o próximo do autenticador. A promoção não foi repetida.',
      };
    }
    return { aceito: true, codigo: 'OK', mensagem: 'Código aceito.' };
  }
}
