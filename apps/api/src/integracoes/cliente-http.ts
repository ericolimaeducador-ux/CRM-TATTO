import { Injectable } from '@nestjs/common';
import { buscarJson } from './http-externo';

const TIMEOUT_MS = 3000;

@Injectable()
export class ClienteHttp {
  fetchImpl: typeof fetch = fetch;

  buscar(url: string, headers?: Record<string, string>) {
    return buscarJson(url, { fetchImpl: this.fetchImpl, headers, timeoutMs: TIMEOUT_MS });
  }
}
