import { FormEvent, useState } from 'react';
import { urlDaApi } from '@/lib/api-url';
import { cabecalhosDaSessao, podeExportar, podeImportar } from '@/lib/offline/sessao';

interface RespostaJson {
  mensagem?: string;
  erros?: { mensagem?: string }[];
  dados?: { importados?: number; duplicatas?: number };
}

export function PainelPlanilha({ aoMensagem }: { aoMensagem: (texto: string) => void }) {
  const [planilha, setPlanilha] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const exportar = podeExportar();
  const importar = podeImportar();
  if (!exportar && !importar) return null;

  async function baixar(formato: 'csv' | 'xlsx') {
    const resposta = await fetch(urlDaApi(`/v1/exportacoes?formato=${formato}`), {
      headers: cabecalhosDaSessao(),
    });
    if (!resposta.ok) {
      const json = (await resposta.json()) as RespostaJson;
      aoMensagem(textoDe(json, 'A exportação não saiu. Confirme o código do autenticador.'));
      return;
    }
    const blob = await resposta.blob();
    const url = URL.createObjectURL(blob);
    const ancora = document.createElement('a');
    ancora.href = url;
    ancora.download = `captura7-leads.${formato}`;
    ancora.click();
    URL.revokeObjectURL(url);
    aoMensagem(`Arquivo ${formato.toUpperCase()} baixado.`);
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const corpo = arquivo ? await corpoDoArquivo(arquivo) : { texto: planilha };
    const resposta = await fetch(urlDaApi('/v1/importacoes'), {
      method: 'POST',
      headers: cabecalhosDaSessao(),
      body: JSON.stringify(corpo),
    });
    const json = (await resposta.json()) as RespostaJson;
    if (!resposta.ok) {
      aoMensagem(textoDe(json, 'A planilha não entrou.'));
      return;
    }
    aoMensagem(
      `Importação pronta. Novos: ${json.dados?.importados ?? 0}. Repetidos: ${json.dados?.duplicatas ?? 0}.`,
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {exportar ? (
        <>
          <button
            type="button"
            className="min-h-12 rounded-lg border border-stone-900 px-4"
            onClick={() => void baixar('csv')}
          >
            Baixar CSV
          </button>
          <button
            type="button"
            className="min-h-12 rounded-lg border border-stone-900 px-4"
            onClick={() => void baixar('xlsx')}
          >
            Baixar XLSX
          </button>
        </>
      ) : null}
      {importar ? (
        <form className="flex flex-col gap-2" onSubmit={(evento) => void enviar(evento)}>
          <label className="flex flex-col gap-1 text-base">
            Planilha CSV do Google
            <textarea
              className="min-h-24 rounded border border-stone-400 px-3 py-2"
              value={planilha}
              onChange={(evento) => setPlanilha(evento.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-base">
            Arquivo CSV ou XLSX
            <input
              className="min-h-12"
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(evento) => setArquivo(evento.target.files?.[0] ?? null)}
            />
          </label>
          <button type="submit" className="min-h-12 rounded-lg border border-stone-900 px-4">
            Importar planilha
          </button>
        </form>
      ) : null}
    </div>
  );
}

function lerBytes(arquivo: File): Promise<ArrayBuffer> {
  if (typeof arquivo.arrayBuffer === 'function') return arquivo.arrayBuffer();
  return new Promise((resolver, rejeitar) => {
    const leitor = new FileReader();
    leitor.onload = () => resolver(leitor.result as ArrayBuffer);
    leitor.onerror = () => rejeitar(leitor.error ?? new Error('arquivo ilegível'));
    leitor.readAsArrayBuffer(arquivo);
  });
}

async function corpoDoArquivo(arquivo: File): Promise<{ texto?: string; xlsxBase64?: string }> {
  const nome = arquivo.name.toLowerCase();
  if (nome.endsWith('.csv') || arquivo.type.includes('csv')) return { texto: await arquivo.text() };
  const bytes = new Uint8Array(await lerBytes(arquivo));
  let binario = '';
  for (const byte of bytes) binario += String.fromCharCode(byte);
  return { xlsxBase64: btoa(binario) };
}

function textoDe(json: RespostaJson, reserva: string): string {
  return json.erros?.[0]?.mensagem ?? json.mensagem ?? reserva;
}
