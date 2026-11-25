import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { urlDaApi } from '@/lib/api-url';
import { textoDaResposta } from '@/lib/texto-resposta';
import { cabecalhosDaSessao, perfilLogado, podeAuditar, podeGerir } from '@/lib/offline/sessao';
import { dataHoraBr } from '@/lib/datas';
import { AcoesSensiveis } from './AcoesSensiveis';
import { useEquipe } from '../comercial/api';
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
  enderecos?: { cidade?: string; uf?: string; logradouro?: string; numero?: string }[];
  pf?: { cpfMascarado?: string };
  pj?: { cnpjMascarado?: string };
  origem?: { modo?: string; vendedorAtribuido?: string };
  completude?: { score?: number };
  lgpd?: { contatoComercial?: string };
  triagem?: { situacao?: string; motivo?: string; retomarEm?: string };
}

interface LinhaAuditoria {
  _id?: string;
  campo?: string;
  timestampServidor?: string;
}

type CampoEditavel = 'nome' | 'email' | 'telefone' | 'tipoPessoa' | 'cidade' | 'uf' | 'documento';

const TIPOS_PESSOA: Record<string, string> = {
  PJ: 'Estúdio (pessoa jurídica)',
  PF: 'Tatuador autônomo (pessoa física)',
  INDEFINIDO: 'Não informado',
};

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
  // O bloco "O que fazer" fica no topo para quem trabalha o contato (ADR-030).
  const painel = contato && editar && status !== 'descartado' ? contato : null;

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">
        {contato?.nome?.trim() || 'Contato sem nome informado'}
      </h1>
      <p className="text-base">
        Cadastro {nomeDoStatus(status)} · Autorização para contato:{' '}
        {contato?.lgpd?.contatoComercial ?? 'sem leitura'}.
      </p>
      {painel ? (
        <section
          className="cartao flex flex-col gap-3 border-2"
          aria-label="O que fazer com este contato"
        >
          <h2 className="text-xl font-semibold">O que fazer com este contato</h2>
          <Triagem
            id={id}
            contato={painel}
            aoTriar={(atual, texto) => {
              if (atual) setContato(atual);
              setMensagem(texto);
            }}
          />
          <Responsavel
            id={id}
            contato={painel}
            gestao={gerir}
            aoPassar={(responsavelId, texto) => {
              setContato((antes) =>
                antes
                  ? { ...antes, origem: { ...antes.origem, vendedorAtribuido: responsavelId } }
                  : antes,
              );
              setMensagem(texto);
            }}
          />
          {mensagem ? (
            <p className="text-base font-semibold" role="status">
              {mensagem}
            </p>
          ) : null}
        </section>
      ) : null}
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
      {contato && editar && (contato.lgpd?.contatoComercial ?? 'pendente') === 'pendente' ? (
        <RegistrarAceite
          id={id}
          aoRegistrar={(atual, texto) => {
            if (atual) setContato(atual);
            setMensagem(texto);
          }}
        />
      ) : null}
      {!gerir ? (
        <p className="text-base">
          Qualificar, descartar, reabrir, revogar e eliminar pedem gestor ou admin.
        </p>
      ) : null}
      {gerir && contato ? (
        <details className="cartao">
          <summary className="cursor-pointer text-base font-semibold">
            Mais ações (cadastro, cliente, descarte e LGPD)
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            <p className="text-sm">
              No dia a dia, use o bloco &quot;O que fazer com este contato&quot;. Estas ações mudam
              o cadastro: qualificar exige cidade, UF e tipo; virar cliente exige CPF/CNPJ, endereço
              e o código do autenticador.
            </p>
            {podePromover(status) ? (
              <Link className="atalho" to={`/promover/${id}`}>
                Promover a cliente
              </Link>
            ) : null}
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
          </div>
        </details>
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
      {mensagem && !painel ? (
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
      <Linha rotulo="Tipo" valor={TIPOS_PESSOA[contato.tipoPessoa ?? 'INDEFINIDO'] ?? ''} />
      <Linha
        rotulo="Cidade/UF"
        valor={[contato.enderecos?.[0]?.cidade, contato.enderecos?.[0]?.uf]
          .filter((x) => x?.trim())
          .join(' / ')}
      />
      <Linha
        rotulo="CPF/CNPJ"
        valor={contato.pj?.cnpjMascarado ?? contato.pf?.cpfMascarado ?? ''}
      />
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
    tipoPessoa: contato.tipoPessoa ?? 'INDEFINIDO',
    cidade: contato.enderecos?.[0]?.cidade ?? '',
    uf: contato.enderecos?.[0]?.uf ?? '',
    // O documento nunca volta aberto da API; só é enviado quando alguém digita.
    documento: '',
  };
  const [valores, setValores] = useState(iniciais);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    let atual = contato;
    try {
      for (const campo of [
        'nome',
        'email',
        'telefone',
        'tipoPessoa',
        'cidade',
        'uf',
        'documento',
      ] as const) {
        if (valores[campo].trim() === iniciais[campo].trim()) continue;
        const digitos = valores.documento.replace(/\D/g, '');
        const nomeApi = campo === 'documento' ? (digitos.length > 11 ? 'cnpj' : 'cpf') : campo;
        const valor = campo === 'uf' ? valores.uf.trim().toUpperCase() : valores[campo];
        const resposta = await fetch(urlDaApi(`/v1/contatos/${id}`), {
          method: 'PATCH',
          headers: cabecalhosDaSessao(),
          body: JSON.stringify({ campo: nomeApi, valor, versaoConhecida: atual.versao }),
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
      <label className="flex flex-col gap-1 text-base">
        É estúdio ou tatuador autônomo?
        <select
          className="campo"
          value={valores.tipoPessoa}
          onChange={(evento) => setValores({ ...valores, tipoPessoa: evento.target.value })}
        >
          {Object.entries(TIPOS_PESSOA).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-2">
        <label className="flex flex-1 flex-col gap-1 text-base">
          Cidade
          <input
            className="campo"
            autoComplete="address-level2"
            value={valores.cidade}
            onChange={(evento) => setValores({ ...valores, cidade: evento.target.value })}
          />
        </label>
        <label className="flex w-20 flex-col gap-1 text-base">
          UF
          <input
            className="campo"
            maxLength={2}
            autoComplete="address-level1"
            value={valores.uf}
            onChange={(evento) => setValores({ ...valores, uf: evento.target.value.toUpperCase() })}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-base">
        CPF ou CNPJ (opcional; só é exigido para virar cliente)
        <input
          className="campo"
          inputMode="numeric"
          autoComplete="off"
          placeholder={contato.pj?.cnpjMascarado ?? contato.pf?.cpfMascarado ?? 'Somente números'}
          value={valores.documento}
          onChange={(evento) => setValores({ ...valores, documento: evento.target.value })}
        />
      </label>
      <button type="submit" className="btn disabled:opacity-40" disabled={salvando}>
        {salvando ? 'Salvando…' : 'Salvar dados'}
      </button>
      <button type="button" className="btn-secundario" onClick={aoFechar}>
        Cancelar
      </button>
    </form>
  );
}

function RegistrarAceite({
  id,
  aoRegistrar,
}: {
  id: string;
  aoRegistrar: (contato: ContatoLido | null, mensagem: string) => void;
}) {
  const [confirmado, setConfirmado] = useState(false);
  const [salvando, setSalvando] = useState(false);

  async function registrar() {
    setSalvando(true);
    try {
      const resposta = await fetch(urlDaApi(`/v1/contatos/${id}/consentimento`), {
        method: 'POST',
        headers: cabecalhosDaSessao(),
        body: JSON.stringify({ contatoComercial: true, emDispositivo: new Date().toISOString() }),
      });
      const json = (await resposta.json()) as {
        dados?: ContatoLido;
        erros?: { mensagem?: string }[];
        mensagem?: string;
      };
      if (!resposta.ok) {
        aoRegistrar(null, textoDaResposta(json, 'Não registrei o aceite. Nada foi alterado.'));
        return;
      }
      aoRegistrar(
        json.dados ?? null,
        'Aceite registrado em seu nome. O contato já pode entrar em campanhas.',
      );
    } catch {
      aoRegistrar(null, 'Sem resposta do servidor. Não registrei o aceite. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="cartao flex flex-col gap-3" aria-labelledby="titulo-aceite">
      <h2 id="titulo-aceite" className="text-lg font-semibold">
        Aceite de contato comercial pendente
      </h2>
      <p className="text-base">
        Sem este aceite o contato fica de fora das campanhas. Registre apenas depois que a pessoa
        disser que aceita receber contato da Tela Viva. O registro fica com seu nome, data e versão
        do termo.
      </p>
      <label className="flex items-start gap-2 text-base">
        <input
          type="checkbox"
          checked={confirmado}
          onChange={(evento) => setConfirmado(evento.target.checked)}
        />
        Confirmo que a pessoa autorizou receber contato comercial.
      </label>
      <button
        type="button"
        className="btn disabled:opacity-40"
        disabled={!confirmado || salvando}
        onClick={() => void registrar()}
      >
        {salvando ? 'Registrando…' : 'Registrar aceite'}
      </button>
    </div>
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

/** Triagem do SDR (ADR-029): Interessado entra na carteira; Desinteressado volta em 6 meses. */
function Triagem({
  id,
  contato,
  aoTriar,
}: {
  id: string;
  contato: ContatoLido;
  aoTriar: (contato: ContatoLido | null, mensagem: string) => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const situacao = contato.triagem?.situacao ?? '';
  async function triar(nova: 'interessado' | 'desinteressado' | 'saiu') {
    setSalvando(true);
    try {
      const resposta = await fetch(urlDaApi(`/v1/contatos/${id}/triagem`), {
        method: 'POST',
        headers: cabecalhosDaSessao(),
        body: JSON.stringify({ situacao: nova, ...(motivo.trim() ? { motivo } : {}) }),
      });
      const json = (await resposta.json()) as {
        dados?: ContatoLido;
        erros?: { mensagem?: string }[];
        mensagem?: string;
      };
      if (!resposta.ok) {
        aoTriar(null, textoDaResposta(json, 'Não registrei a triagem. Nada foi alterado.'));
        return;
      }
      aoTriar(
        json.dados ?? null,
        nova === 'interessado'
          ? 'Interessado: o contato entrou na carteira (Funil · Conversa de 15 min).'
          : nova === 'saiu'
            ? 'Pediu para sair: o WhatsApp dele não recebe mais campanhas.'
            : 'Desinteressado: sai das campanhas e volta a ser lembrado em 6 meses.',
      );
      setMotivo('');
    } catch {
      aoTriar(null, 'Sem resposta do servidor. Não registrei a triagem.');
    } finally {
      setSalvando(false);
    }
  }
  return (
    <div className="cartao flex flex-col gap-2" aria-label="Triagem">
      <p className="text-base">
        <span className="font-semibold">Triagem:</span>{' '}
        {situacao === 'interessado'
          ? 'interessado, já está na carteira.'
          : situacao === 'desinteressado'
            ? `desinteressado${contato.triagem?.motivo ? ` (${contato.triagem.motivo})` : ''}${
                contato.triagem?.retomarEm
                  ? `, retomar em ${new Date(contato.triagem.retomarEm).toLocaleDateString('pt-BR')}`
                  : ''
              }.`
            : situacao === 'saiu'
              ? 'pediu para sair, não recebe mais campanhas por WhatsApp.'
              : 'ainda não respondeu ou não foi avaliado.'}
      </p>
      {situacao === 'interessado' ? (
        <Link className="atalho" to={`/carteira?q=${encodeURIComponent(contato.nome ?? '')}`}>
          Ver na carteira
        </Link>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {situacao !== 'interessado' ? (
          <button
            type="button"
            className="btn disabled:opacity-40"
            disabled={salvando}
            onClick={() => void triar('interessado')}
          >
            Interessado
          </button>
        ) : null}
        {situacao !== 'desinteressado' ? (
          <button
            type="button"
            className="btn-secundario disabled:opacity-40"
            disabled={salvando}
            onClick={() => void triar('desinteressado')}
          >
            Desinteressado
          </button>
        ) : null}
        {situacao !== 'saiu' ? (
          <button
            type="button"
            className="btn-secundario disabled:opacity-40"
            disabled={salvando}
            onClick={() => void triar('saiu')}
          >
            Pediu para sair
          </button>
        ) : null}
      </div>
      {situacao !== 'desinteressado' ? (
        <label className="flex flex-col gap-1 text-base">
          Motivo, se desinteressado (opcional)
          <input
            className="campo"
            value={motivo}
            onChange={(evento) => setMotivo(evento.target.value)}
          />
        </label>
      ) : null}
    </div>
  );
}

/**
 * Quem vai atender o contato (ADR-030). A gestão passa para alguém da equipe com um
 * seletor e um botão; o representante só vê quem é o responsável.
 */
function Responsavel({
  id,
  contato,
  gestao,
  aoPassar,
}: {
  id: string;
  contato: ContatoLido;
  gestao: boolean;
  aoPassar: (responsavelId: string, mensagem: string) => void;
}) {
  const { equipe, carregando } = useEquipe(gestao);
  const atual = contato.origem?.vendedorAtribuido ? String(contato.origem.vendedorAtribuido) : '';
  const [escolhido, setEscolhido] = useState(atual);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => setEscolhido(atual), [atual]);
  const pessoas = equipe.filter((p) => ['vendedor', 'gestor', 'admin'].includes(p.papel ?? ''));
  const nomeAtual = pessoas.find((p) => p.id === atual)?.nome;
  if (!gestao)
    return (
      <p className="text-base">
        <span className="font-semibold">Responsável:</span>{' '}
        {atual ? 'você ou alguém da equipe já cuida deste contato.' : 'ainda ninguém.'}
      </p>
    );
  async function passar() {
    if (!escolhido || escolhido === atual) return;
    setSalvando(true);
    try {
      const resposta = await fetch(urlDaApi('/v1/contatos/atribuir'), {
        method: 'POST',
        headers: cabecalhosDaSessao(),
        body: JSON.stringify({ ids: [id], responsavelId: escolhido }),
      });
      const json = (await resposta.json().catch(() => null)) as {
        erros?: { mensagem?: string }[];
        mensagem?: string;
      } | null;
      if (!resposta.ok) {
        aoPassar(atual, textoDaResposta(json ?? {}, 'Não passei o contato. Nada mudou.'));
        return;
      }
      const nome = pessoas.find((p) => p.id === escolhido)?.nome ?? 'a pessoa escolhida';
      aoPassar(escolhido, `Contato passado para ${nome}. Ele já aparece na carteira dessa pessoa.`);
    } catch {
      aoPassar(atual, 'Sem resposta do servidor. Não passei o contato.');
    } finally {
      setSalvando(false);
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-base">
        <span>
          <span className="font-semibold">Quem vai atender:</span>{' '}
          {nomeAtual ?? (atual ? 'alguém da equipe' : 'ainda ninguém')}
        </span>
        <select
          className="campo"
          value={escolhido}
          disabled={carregando || salvando}
          onChange={(evento) => setEscolhido(evento.target.value)}
        >
          <option value="">Escolha quem vai atender</option>
          {pessoas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="btn disabled:opacity-40"
        disabled={!escolhido || escolhido === atual || salvando}
        onClick={() => void passar()}
      >
        {salvando ? 'Passando…' : 'Passar para esta pessoa'}
      </button>
    </div>
  );
}
