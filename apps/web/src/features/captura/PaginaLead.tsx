import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { urlDaApi } from '@/lib/api-url';
import { textoDaResposta } from '@/lib/texto-resposta';
import { cabecalhosDaSessao, perfilLogado, podeAuditar, podeGerir } from '@/lib/offline/sessao';
import { dataHoraBr } from '@/lib/datas';
import { AcoesSensiveis } from './AcoesSensiveis';
import {
  acoesDeStatus,
  nomeDaOrigem,
  nomeDoStatus,
  podeDescartar,
  podePromover,
} from './transicoes-lead';

interface ContatoLido {
  nome?: string | null;
  status?: string;
  versao?: number;
  tipoPessoa?: string;
  criadoEm?: string;
  emails?: { valor?: string }[];
  telefones?: { e164?: string; bruto?: string }[];
  origem?: { modo?: string };
  completude?: { score?: number };
  lgpd?: { contatoComercial?: string };
}

interface LinhaAuditoria {
  _id?: string;
  campo?: string;
  timestampServidor?: string;
}

type CampoEditavel = 'nome' | 'email' | 'telefone';

export function PaginaLead() {
  const { id = '' } = useParams();
  const [contato, setContato] = useState<ContatoLido | null>(null);
  const [carregou, setCarregou] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [trilha, setTrilha] = useState<LinhaAuditoria[] | null>(null);
  const [editando, setEditando] = useState(false);
  const gerir = podeGerir();
  const auditar = podeAuditar();
  const papel = perfilLogado()?.papel;
  const editar = papel === 'vendedor' || papel === 'gestor' || papel === 'admin';

  useEffect(() => {
    void ler(id).then((lido) => {
      setContato(lido);
      setCarregou(true);
    });
  }, [id]);

  const status = contato?.status;
  const acoes = acoesDeStatus(status);

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Lead</h1>
      <p className="text-base">
        {contato?.nome?.trim() || 'Contato sem nome informado'} está em {nomeDoStatus(status)}.
        Consentimento: {contato?.lgpd?.contatoComercial ?? 'sem leitura'}.
      </p>
      {carregou && !contato ? (
        <p className="text-base">
          Não consegui abrir este contato. Entre de novo e tente outra vez.
        </p>
      ) : null}
      {contato ? (
        editando ? (
          <EdicaoDoLead
            id={id}
            contato={contato}
            aoSalvar={(atual, texto) => {
              if (atual) setContato(atual);
              setMensagem(texto);
            }}
            aoFechar={() => setEditando(false)}
          />
        ) : (
          <DadosDoLead contato={contato} aoEditar={editar ? () => setEditando(true) : undefined} />
        )
      ) : null}
      {gerir && podePromover(status) ? (
        <Link className="atalho" to={`/promover/${id}`}>
          Promover a cliente
        </Link>
      ) : null}
      {!gerir ? (
        <p className="text-base">
          Qualificar, descartar, reabrir, revogar e eliminar pedem gestor ou admin.
        </p>
      ) : null}
      {gerir && contato ? (
        <>
          {acoes.map((acao) => (
            <Acao
              key={acao.para}
              rotulo={acao.rotulo}
              aoClicar={() => transicao(id, { para: acao.para }, setMensagem, setContato)}
            />
          ))}
          {podeDescartar(status) ? (
            <>
              <label className="flex flex-col gap-1 text-base">
                Motivo do descarte
                <input
                  className="campo"
                  value={motivo}
                  onChange={(evento) => setMotivo(evento.target.value)}
                />
              </label>
              <Acao
                rotulo="Descartar"
                aoClicar={() =>
                  transicao(id, { para: 'descartado', motivo }, setMensagem, setContato)
                }
              />
            </>
          ) : null}
          <AcoesSensiveis
            id={id}
            nome={contato?.nome ?? ''}
            aoAtualizar={(atual, texto) => {
              if (atual) setContato((antes) => ({ ...antes, ...atual }));
              setMensagem(texto);
            }}
          />
        </>
      ) : null}
      {auditar ? (
        <button
          type="button"
          className="btn-secundario"
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
              {linha.campo ?? 'campo'} · {dataHoraBr(linha.timestampServidor)}
            </li>
          ))}
        </ul>
      ) : null}
      {mensagem ? (
        <p className="text-base" role="status">
          {mensagem}
        </p>
      ) : null}
    </section>
  );
}

function DadosDoLead({ contato, aoEditar }: { contato: ContatoLido; aoEditar?: () => void }) {
  const email = contato.emails?.[0]?.valor ?? '';
  const telefone = contato.telefones?.[0]?.e164 ?? contato.telefones?.[0]?.bruto ?? '';
  return (
    <div className="cartao flex flex-col gap-2" data-testid="dados-lead">
      <Linha rotulo="Nome" valor={contato.nome ?? ''} />
      <Linha rotulo="E-mail" valor={email} />
      <Linha rotulo="Telefone" valor={telefone} />
      <Linha rotulo="Pessoa" valor={contato.tipoPessoa ?? 'INDEFINIDO'} />
      <Linha rotulo="Origem" valor={nomeDaOrigem(contato.origem?.modo)} />
      <Linha rotulo="Criado em" valor={dataHoraBr(contato.criadoEm)} />
      {aoEditar ? (
        <button type="button" className="btn-secundario" onClick={aoEditar}>
          Editar dados
        </button>
      ) : null}
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <p className="text-base">
      <span className="font-semibold">{rotulo}:</span> {valor.trim() || 'não informado'}
    </p>
  );
}

function EdicaoDoLead({
  id,
  contato,
  aoSalvar,
  aoFechar,
}: {
  id: string;
  contato: ContatoLido;
  aoSalvar: (contato: ContatoLido | null, mensagem: string) => void;
  aoFechar: () => void;
}) {
  const iniciais: Record<CampoEditavel, string> = {
    nome: contato.nome ?? '',
    email: contato.emails?.[0]?.valor ?? '',
    telefone: contato.telefones?.[0]?.bruto ?? contato.telefones?.[0]?.e164 ?? '',
  };
  const [valores, setValores] = useState(iniciais);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    let atual = contato;
    try {
      for (const campo of ['nome', 'email', 'telefone'] as const) {
        if (valores[campo].trim() === iniciais[campo].trim()) continue;
        const resposta = await fetch(urlDaApi(`/v1/contatos/${id}`), {
          method: 'PATCH',
          headers: cabecalhosDaSessao(),
          body: JSON.stringify({ campo, valor: valores[campo], versaoConhecida: atual.versao }),
        });
        const json = (await resposta.json()) as {
          dados?: ContatoLido;
          erros?: { mensagem?: string }[];
          mensagem?: string;
        };
        if (!resposta.ok) {
          aoSalvar(null, textoDaResposta(json, 'Não salvei. Os dados continuam como estavam.'));
          return;
        }
        if (json.dados) atual = json.dados;
      }
      aoSalvar(atual, 'Dados salvos.');
      aoFechar();
    } catch {
      aoSalvar(null, 'Sem resposta do servidor. Não salvei. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form
      className="cartao flex flex-col gap-3"
      onSubmit={(evento) => {
        evento.preventDefault();
        void salvar();
      }}
    >
      {(
        [
          ['nome', 'Nome', 'text', 'name'],
          ['email', 'E-mail', 'email', 'email'],
          ['telefone', 'Telefone', 'tel', 'tel'],
        ] as const
      ).map(([campo, rotulo, tipo, auto]) => (
        <label key={campo} className="flex flex-col gap-1 text-base">
          {rotulo}
          <input
            className="campo"
            type={tipo}
            autoComplete={auto}
            value={valores[campo]}
            onChange={(evento) => setValores({ ...valores, [campo]: evento.target.value })}
          />
        </label>
      ))}
      <button type="submit" className="btn disabled:opacity-40" disabled={salvando}>
        {salvando ? 'Salvando…' : 'Salvar dados'}
      </button>
      <button type="button" className="btn-secundario" onClick={aoFechar}>
        Cancelar
      </button>
    </form>
  );
}

function Acao({ rotulo, aoClicar }: { rotulo: string; aoClicar: () => Promise<void> }) {
  return (
    <button type="button" className="btn" onClick={() => void aoClicar()}>
      {rotulo}
    </button>
  );
}

async function ler(id: string): Promise<ContatoLido | null> {
  if (!id) return null;
  try {
    const resposta = await fetch(urlDaApi(`/v1/contatos/${id}`), {
      headers: cabecalhosDaSessao(),
    });
    if (!resposta.ok) return null;
    const json = (await resposta.json()) as { dados?: ContatoLido };
    return json.dados ?? null;
  } catch {
    return null;
  }
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
  definirMensagem(`Status agora: ${nomeDoStatus(json.dados?.status)}.`);
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
