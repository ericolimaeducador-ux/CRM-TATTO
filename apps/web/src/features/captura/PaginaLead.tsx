import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { urlDaApi } from '@/lib/api-url';
import { textoDaResposta } from '@/lib/texto-resposta';
import { cabecalhosDaSessao, podeAuditar, podeGerir } from '@/lib/offline/sessao';
import { AcoesSensiveis } from './AcoesSensiveis';

interface ContatoLido {
  nome?: string;
  status?: string;
  lgpd?: { contatoComercial?: string };
}

interface LinhaAuditoria {
  _id?: string;
  campo?: string;
  timestampServidor?: string;
}

export function PaginaLead() {
  const { id = '' } = useParams();
  const [contato, setContato] = useState<ContatoLido | null>(null);
  const [motivo, setMotivo] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [trilha, setTrilha] = useState<LinhaAuditoria[] | null>(null);
  const gerir = podeGerir();
  const auditar = podeAuditar();

  useEffect(() => {
    void ler(id).then(setContato);
  }, [id]);

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Lead</h1>
      <p className="text-base">
        {contato?.nome?.trim() || 'Contato sem nome informado'} está em {contato?.status ?? '…'}.
        Consentimento: {contato?.lgpd?.contatoComercial ?? 'sem leitura'}.
      </p>
      {gerir ? (
        <Link
          className="inline-flex min-h-12 items-center text-base underline"
          to={`/promover/${id}`}
        >
          Promover a cliente
        </Link>
      ) : (
        <p className="text-base">
          Qualificar, descartar, reabrir, revogar e eliminar pedem gestor ou admin.
        </p>
      )}
      {gerir ? (
        <>
          <Acao
            rotulo="Qualificar"
            aoClicar={() => transicao(id, { para: 'qualificado' }, setMensagem, setContato)}
          />
          <label className="flex flex-col gap-1 text-base">
            Motivo do descarte
            <input
              className="min-h-12 rounded border border-stone-300 px-3"
              value={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
            />
          </label>
          <Acao
            rotulo="Descartar"
            aoClicar={() => transicao(id, { para: 'descartado', motivo }, setMensagem, setContato)}
          />
          <Acao
            rotulo="Reabrir como rascunho"
            aoClicar={() => transicao(id, { para: 'rascunho' }, setMensagem, setContato)}
          />
          <Acao
            rotulo="Reabrir como capturado"
            aoClicar={() => transicao(id, { para: 'capturado' }, setMensagem, setContato)}
          />
          <AcoesSensiveis
            id={id}
            nome={contato?.nome ?? ''}
            aoAtualizar={(atual, texto) => {
              if (atual) setContato(atual);
              setMensagem(texto);
            }}
          />
        </>
      ) : null}
      {auditar ? (
        <button
          type="button"
          className="min-h-12 rounded-lg border border-stone-900 px-4 text-base"
          onClick={() => void carregarTrilha(id, setTrilha, setMensagem)}
        >
          Ver trilha de auditoria
        </button>
      ) : null}
      {trilha ? (
        <ul className="flex flex-col gap-2">
          {trilha.length === 0 ? <li className="text-base">Nenhuma linha nesta trilha.</li> : null}
          {trilha.map((linha, indice) => (
            <li key={linha._id ?? `${linha.campo}-${indice}`} className="text-base">
              {linha.campo ?? 'campo'} · {linha.timestampServidor ?? 'sem horário'}
            </li>
          ))}
        </ul>
      ) : null}
      {mensagem ? <p className="text-base">{mensagem}</p> : null}
    </section>
  );
}

function Acao({ rotulo, aoClicar }: { rotulo: string; aoClicar: () => Promise<void> }) {
  return (
    <button
      type="button"
      className="min-h-12 rounded-lg bg-stone-900 px-4 text-base text-white"
      onClick={() => void aoClicar()}
    >
      {rotulo}
    </button>
  );
}

async function ler(id: string): Promise<ContatoLido | null> {
  if (!id) return null;
  const resposta = await fetch(urlDaApi(`/v1/contatos/${id}`), { headers: cabecalhosDaSessao() });
  if (!resposta.ok) return null;
  const json = (await resposta.json()) as { dados?: ContatoLido };
  return json.dados ?? null;
}

async function transicao(
  id: string,
  corpo: { para: string; motivo?: string },
  definirMensagem: (texto: string) => void,
  definirContato: (contato: ContatoLido | null) => void,
): Promise<void> {
  const resposta = await fetch(urlDaApi(`/v1/contatos/${id}/transicao`), {
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
    definirMensagem(
      textoDaResposta(json, 'A transição não aconteceu. O contato continua como está.'),
    );
    return;
  }
  if (json.dados) definirContato(json.dados);
  definirMensagem(`Status agora: ${json.dados?.status ?? 'atualizado'}.`);
}

async function carregarTrilha(
  id: string,
  definirTrilha: (linhas: LinhaAuditoria[]) => void,
  definirMensagem: (texto: string) => void,
): Promise<void> {
  const resposta = await fetch(urlDaApi(`/v1/contatos/${id}/auditoria`), {
    headers: cabecalhosDaSessao(),
  });
  const json = (await resposta.json()) as {
    dados?: LinhaAuditoria[];
    erros?: { mensagem?: string }[];
    mensagem?: string;
  };
  if (!resposta.ok) {
    definirMensagem(textoDaResposta(json, 'A trilha não abriu.'));
    return;
  }
  definirTrilha(json.dados ?? []);
}
