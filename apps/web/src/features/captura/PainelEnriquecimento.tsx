import { useState } from 'react';
import { patchCampo } from '@/lib/offline/api';
import { urlDaApi } from '@/lib/api-url';
import { cabecalhosDaSessao } from '@/lib/offline/sessao';

interface Sugestao {
  campo: string;
  valorDigitado: string;
  valorFonte: string;
  fonte: string;
}

interface Aviso {
  mensagem: string;
}

const CAMPOS_DO_FORMULARIO = new Set([
  'nome',
  'telefone',
  'email',
  'cep',
  'logradouro',
  'numero',
  'cidade',
  'uf',
]);

export function PainelEnriquecimento({
  idServidor,
  versaoServidor,
  cnpj,
  cep,
  aoUsarCampo,
}: {
  idServidor?: string;
  versaoServidor?: number;
  cnpj: string;
  cep: string;
  aoUsarCampo: (campo: string, valor: string) => void;
}) {
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  async function consultar(caminho: string, metodo: string, corpo?: unknown) {
    if (!idServidor) return;
    const resposta = await fetch(urlDaApi(caminho), {
      method: metodo,
      headers: cabecalhosDaSessao(),
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    const json = (await resposta.json()) as { sugestoes?: Sugestao[]; avisos?: Aviso[] };
    setSugestoes(json.sugestoes ?? []);
    setAvisos(json.avisos ?? []);
  }

  return (
    <section className="flex flex-col gap-3 rounded border border-stone-300 p-3">
      <h2 className="text-base font-semibold">Consulta oficial</h2>
      <p className="text-base">
        A fonte sugere. O que você digitou permanece até você escolher usar a sugestão.
      </p>
      {!idServidor ? (
        <p className="text-base text-amber-900">
          A consulta oficial espera o contato chegar ao servidor. A captura segue.
        </p>
      ) : null}
      <button
        type="button"
        className="min-h-12 rounded-lg border border-stone-900 px-4 text-base"
        onClick={() =>
          void consultar('/v1/enriquecimento/cnpj', 'POST', { contatoId: idServidor, cnpj })
        }
      >
        Consultar CNPJ
      </button>
      <button
        type="button"
        className="min-h-12 rounded-lg border border-stone-900 px-4 text-base"
        onClick={() =>
          void consultar(`/v1/enriquecimento/cep/${cep}?contatoId=${idServidor}`, 'GET')
        }
      >
        Consultar CEP
      </button>
      {avisos.map((aviso) => (
        <p key={aviso.mensagem} className="text-base text-amber-900">
          {aviso.mensagem}
        </p>
      ))}
      {sugestoes.map((sugestao) => (
        <div key={`${sugestao.campo}-${sugestao.valorFonte}`} className="flex flex-col gap-2">
          <p className="text-base">
            {sugestao.campo}: você digitou “{sugestao.valorDigitado}”. A fonte {sugestao.fonte} diz
            “{sugestao.valorFonte}”.
          </p>
          <button
            type="button"
            className="min-h-12 rounded-lg bg-stone-900 px-4 text-base text-white"
            onClick={() => void usar(sugestao, idServidor, versaoServidor, aoUsarCampo)}
          >
            Usar esta sugestão
          </button>
        </div>
      ))}
    </section>
  );
}

async function usar(
  sugestao: Sugestao,
  idServidor: string | undefined,
  versaoServidor: number | undefined,
  aoUsarCampo: (campo: string, valor: string) => void,
): Promise<void> {
  if (CAMPOS_DO_FORMULARIO.has(sugestao.campo)) {
    aoUsarCampo(sugestao.campo, sugestao.valorFonte);
    return;
  }
  if (!idServidor) return;
  await patchCampo(idServidor, sugestao.campo, sugestao.valorFonte, versaoServidor);
}
