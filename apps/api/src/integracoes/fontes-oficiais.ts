import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { aviso, type Aviso } from '../normalizacao/avisos';
import { ClienteHttp } from './cliente-http';
import { circuitoAberto, registrarResultado } from './circuito';
import { mapearBrasilApi, mapearReceitaWs, mapearViaCep, type DadoOficial } from './mapear-oficial';

const TTL_CNPJ_MS = 30 * 24 * 60 * 60 * 1000;
const BRASILAPI = 'https://brasilapi.com.br/api/cnpj/v1';
const RECEITAWS = 'https://www.receitaws.com.br/v1/cnpj';
const VIACEP = 'https://viacep.com.br/ws';

interface CacheDoc {
  chave: string;
  fonte: string;
  payload: unknown;
  expiraEm?: Date | null;
}

export interface ConsultaOficial {
  dado: DadoOficial | null;
  fonte: string;
  payload: unknown;
  avisos: Aviso[];
  digitos?: string;
}

@Injectable()
export class FontesOficiais {
  constructor(
    @InjectModel('CacheEnriquecimento') private readonly cache: Model<CacheDoc>,
    private readonly http: ClienteHttp,
  ) {}

  async cnpj(digitos: string): Promise<ConsultaOficial> {
    const cache = await this.ler(`cnpj:${digitos}`);
    if (cache) return { ...cache, digitos };
    const brasil = await this.chamar('brasilapi', `${BRASILAPI}/${digitos}`, mapearBrasilApi);
    if (brasil.dado) {
      await this.gravar(
        `cnpj:${digitos}`,
        'brasilapi',
        brasil.payload,
        new Date(Date.now() + TTL_CNPJ_MS),
      );
      return { ...brasil, digitos };
    }
    const receita = await this.chamar('receitaws', `${RECEITAWS}/${digitos}`, mapearReceitaWs);
    if (receita.dado) {
      await this.gravar(
        `cnpj:${digitos}`,
        'receitaws',
        receita.payload,
        new Date(Date.now() + TTL_CNPJ_MS),
      );
    }
    return { ...receita, digitos, avisos: [...brasil.avisos, ...receita.avisos] };
  }

  async cep(digitos: string): Promise<ConsultaOficial> {
    const cache = await this.ler(`cep:${digitos}`);
    if (cache) return cache;
    const via = await this.chamar('viacep', `${VIACEP}/${digitos}/json/`, mapearViaCep);
    if (via.dado) await this.gravar(`cep:${digitos}`, 'viacep', via.payload, null);
    return via;
  }

  private async chamar(
    fonte: string,
    url: string,
    mapear: (json: unknown) => DadoOficial | null,
  ): Promise<ConsultaOficial> {
    if (circuitoAberto(fonte)) {
      return {
        dado: null,
        fonte,
        payload: null,
        avisos: [
          aviso(
            fonte,
            'CIRCUITO_ABERTO',
            'A fonte oficial falhou vezes demais. A captura segue sem esse enriquecimento.',
          ),
        ],
      };
    }
    try {
      const resposta = await this.http.buscar(url);
      const dado = resposta.status >= 200 && resposta.status < 300 ? mapear(resposta.json) : null;
      registrarResultado(fonte, Boolean(dado));
      if (!dado) {
        return {
          dado: null,
          fonte,
          payload: resposta.json,
          avisos: [
            aviso(
              fonte,
              'FONTE_INDISPONIVEL',
              'A fonte oficial não devolveu um cadastro útil. O contato continua salvo.',
            ),
          ],
        };
      }
      return { dado, fonte, payload: resposta.json, avisos: [] };
    } catch {
      registrarResultado(fonte, false);
      return {
        dado: null,
        fonte,
        payload: { falha: 'timeout' },
        avisos: [
          aviso(
            fonte,
            'FONTE_INDISPONIVEL',
            'A fonte oficial não respondeu a tempo. O contato continua salvo.',
          ),
        ],
      };
    }
  }

  private async ler(chave: string): Promise<ConsultaOficial | null> {
    const item = await this.cache.findOne({ chave }).lean<CacheDoc>();
    if (!item || (item.expiraEm && item.expiraEm.getTime() <= Date.now())) return null;
    const mapear =
      item.fonte === 'brasilapi'
        ? mapearBrasilApi
        : item.fonte === 'receitaws'
          ? mapearReceitaWs
          : mapearViaCep;
    const dado = mapear(item.payload);
    if (!dado) return null;
    return { dado, fonte: item.fonte, payload: item.payload, avisos: [] };
  }

  private async gravar(chave: string, fonte: string, payload: unknown, expiraEm: Date | null) {
    await this.cache.updateOne({ chave }, { chave, fonte, payload, expiraEm }, { upsert: true });
  }
}
