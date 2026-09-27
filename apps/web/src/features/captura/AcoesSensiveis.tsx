import { useState } from 'react';
import { urlDaApi } from '@/lib/api-url';
import { textoDaResposta } from '@/lib/texto-resposta';
import { cabecalhosDaSessao } from '@/lib/offline/sessao';

interface ContatoLido {
  nome?: string;
  status?: string;
  lgpd?: { contatoComercial?: string };
}

export function AcoesSensiveis({
  id,
  nome,
  aoAtualizar,
}: {
  id: string;
  nome: string;
  aoAtualizar: (contato: ContatoLido | null, mensagem: string) => void;
}) {
  const [revogar, setRevogar] = useState(false);
  const [eliminar, setEliminar] = useState(false);
  const [confirmacao, setConfirmacao] = useState('');
  const aceita = confirmacaoConfere(confirmacao, nome);

  return (
    <>
      <button
        type="button"
        className="min-h-12 rounded-lg bg-stone-900 px-4 text-base text-white"
        onClick={() => setRevogar(true)}
      >
        Revogar consentimento
      </button>
      {revogar ? (
        <>
          <button
            type="button"
            className="min-h-12 rounded-lg border border-stone-900 px-4 text-base"
            onClick={() => void enviar(id, 'revogacao', { confirmar: true }, aoAtualizar)}
          >
            Confirmar revogação
          </button>
          <button
            type="button"
            className="min-h-12 rounded-lg border border-stone-900 px-4 text-base"
            onClick={() => setRevogar(false)}
          >
            Cancelar revogação
          </button>
        </>
      ) : null}
      <button
        type="button"
        className="min-h-12 rounded-lg bg-stone-900 px-4 text-base text-white"
        onClick={() => setEliminar(true)}
      >
        Eliminar titular
      </button>
      {eliminar ? (
        <>
          <label className="flex flex-col gap-1 text-base">
            Digite o nome do titular ou ELIMINAR
            <input
              className="min-h-12 rounded border border-stone-300 px-3"
              value={confirmacao}
              onChange={(evento) => setConfirmacao(evento.target.value)}
            />
          </label>
          <button
            type="button"
            className="min-h-12 rounded-lg border border-stone-900 px-4 text-base disabled:opacity-40"
            disabled={!aceita}
            onClick={() =>
              void enviar(id, 'eliminacao', { confirmacao: confirmacao.trim() }, aoAtualizar)
            }
          >
            Confirmar eliminação
          </button>
          <button
            type="button"
            className="min-h-12 rounded-lg border border-stone-900 px-4 text-base"
            onClick={() => {
              setEliminar(false);
              setConfirmacao('');
            }}
          >
            Cancelar eliminação
          </button>
        </>
      ) : null}
    </>
  );
}

export function confirmacaoConfere(confirmacao: string, nome: string): boolean {
  const texto = dobrar(confirmacao);
  if (texto === 'eliminar') return true;
  const atual = dobrar(nome);
  return atual !== '' && texto === atual;
}

function dobrar(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

async function enviar(
  id: string,
  acao: 'revogacao' | 'eliminacao',
  corpo: { confirmar?: boolean; confirmacao?: string },
  aoAtualizar: (contato: ContatoLido | null, mensagem: string) => void,
): Promise<void> {
  const resposta = await fetch(urlDaApi(`/v1/contatos/${id}/${acao}`), {
    method: 'POST',
    headers: cabecalhosDaSessao(),
    body: JSON.stringify(corpo),
  });
  const json = (await resposta.json()) as {
    dados?: ContatoLido;
    erros?: { mensagem?: string }[];
    mensagem?: string;
  };
  if (!resposta.ok) {
    aoAtualizar(null, textoDaResposta(json, 'Nada foi alterado.'));
    return;
  }
  aoAtualizar(
    json.dados ?? null,
    acao === 'revogacao' ? 'Consentimento revogado.' : 'Dados do titular eliminados.',
  );
}
