import { Link } from 'react-router-dom';
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  apiComercial,
  ErroComercial,
  moeda,
  nomeRegistro,
  rotulo,
  todasReferencias,
  useEquipe,
  papelUsuario,
  type ItemProposta,
  type Registro,
  type Secao,
} from './api';
import { Icone } from './componentes';

/** Campos que a conta espelha da ficha do contato (ADR-028); editados só na ficha. */
const ESPELHADOS = new Set([
  'nome',
  'cidade',
  'uf',
  'segmento',
  'contatoNome',
  'contatoEmail',
  'contatoTelefone',
]);

type Campo = {
  chave: string;
  titulo: string;
  tipo?: 'numero' | 'dinheiro' | 'data' | 'horario' | 'texto-longo';
  opcoes?: string[];
  referencia?: 'contas' | 'oportunidades';
  amplo?: boolean;
};
const CAMPOS: Record<Secao, Campo[]> = {
  contas: [
    { chave: 'nome', titulo: 'Nome da instituição', amplo: true },
    {
      chave: 'segmento',
      titulo: 'Segmento',
      opcoes: [
        'estudio_tatuagem',
        'profissional_autonomo',
        'hospital',
        'clinica',
        'farmacia',
        'laboratorio',
        'distribuidor',
        'consultorio',
        'outro',
      ],
    },
    { chave: 'classificacao', titulo: 'Classificação da carteira', opcoes: ['A', 'B', 'C'] },
    { chave: 'status', titulo: 'Relacionamento', opcoes: ['prospect', 'ativo', 'inativo'] },
    { chave: 'especialidade', titulo: 'Especialidade / área de atuação' },
    { chave: 'territorio', titulo: 'Território' },
    { chave: 'frequenciaVisitaDias', titulo: 'Frequência de visitas (dias)', tipo: 'numero' },
    { chave: 'cidade', titulo: 'Cidade' },
    { chave: 'uf', titulo: 'UF' },
    { chave: 'endereco', titulo: 'Endereço', amplo: true },
    { chave: 'contatoNome', titulo: 'Interlocutor / contato principal' },
    { chave: 'contatoEmail', titulo: 'E-mail do contato' },
    { chave: 'contatoTelefone', titulo: 'Telefone do contato' },
    { chave: 'proximaVisita', titulo: 'Próxima visita', tipo: 'horario' },
    { chave: 'proximaAcao', titulo: 'Próxima ação', amplo: true },
    { chave: 'observacoes', titulo: 'Observações comerciais', tipo: 'texto-longo' },
  ],
  produtos: [
    { chave: 'nome', titulo: 'Nome do produto', amplo: true },
    { chave: 'codigo', titulo: 'Código / referência' },
    {
      chave: 'categoria',
      titulo: 'Categoria',
      opcoes: [
        'cosmetico',
        'kit',
        'medicamento',
        'dispositivo',
        'material',
        'equipamento',
        'outro',
      ],
    },
    { chave: 'fabricante', titulo: 'Fabricante / representada' },
    { chave: 'linha', titulo: 'Linha de produtos' },
    { chave: 'unidade', titulo: 'Unidade de apresentação' },
    { chave: 'precoCentavos', titulo: 'Preço de referência (R$)', tipo: 'dinheiro' },
    { chave: 'descricao', titulo: 'Descrição comercial', tipo: 'texto-longo' },
    { chave: 'observacoes', titulo: 'Observações', tipo: 'texto-longo' },
  ],
  oportunidades: [
    { chave: 'titulo', titulo: 'Nome da oportunidade', amplo: true },
    { chave: 'contaId', titulo: 'Conta da carteira', referencia: 'contas' },
    {
      chave: 'etapa',
      titulo: 'Etapa do funil',
      opcoes: [
        'prospeccao',
        'qualificacao',
        'apresentacao',
        'proposta',
        'negociacao',
        'ganho',
        'perdido',
      ],
    },
    { chave: 'valorCentavos', titulo: 'Valor estimado (R$)', tipo: 'dinheiro' },
    { chave: 'probabilidade', titulo: 'Probabilidade (%)', tipo: 'numero' },
    { chave: 'previsao', titulo: 'Previsão de fechamento', tipo: 'data' },
    { chave: 'proximaAcao', titulo: 'Próxima ação' },
    { chave: 'motivoPerda', titulo: 'Motivo da perda, se aplicável', amplo: true },
    { chave: 'observacoes', titulo: 'Observações', tipo: 'texto-longo' },
  ],
  atividades: [
    { chave: 'titulo', titulo: 'Título da visita ou atividade', amplo: true },
    { chave: 'contaId', titulo: 'Conta da carteira', referencia: 'contas' },
    { chave: 'oportunidadeId', titulo: 'Oportunidade relacionada', referencia: 'oportunidades' },
    {
      chave: 'tipo',
      titulo: 'Tipo de atividade',
      opcoes: ['visita', 'ligacao', 'email', 'reuniao', 'tarefa'],
    },
    { chave: 'canal', titulo: 'Canal', opcoes: ['presencial', 'remoto'] },
    { chave: 'data', titulo: 'Data e horário', tipo: 'horario' },
    { chave: 'status', titulo: 'Situação', opcoes: ['planejada', 'concluida', 'cancelada'] },
    { chave: 'local', titulo: 'Local ou link da reunião', amplo: true },
    { chave: 'resultado', titulo: 'Resultado da visita / atividade', tipo: 'texto-longo' },
    { chave: 'realizacao', titulo: 'Como a atividade foi realizada', tipo: 'texto-longo' },
    { chave: 'proximaAcao', titulo: 'Próxima ação', amplo: true },
    { chave: 'observacoes', titulo: 'Observações', tipo: 'texto-longo' },
  ],
  propostas: [
    { chave: 'titulo', titulo: 'Título da proposta', amplo: true },
    { chave: 'contaId', titulo: 'Conta da carteira', referencia: 'contas' },
    { chave: 'oportunidadeId', titulo: 'Oportunidade relacionada', referencia: 'oportunidades' },
    { chave: 'validade', titulo: 'Válida até', tipo: 'data' },
    {
      chave: 'status',
      titulo: 'Situação da proposta',
      opcoes: ['rascunho', 'apresentada', 'aceita', 'recusada'],
    },
    {
      chave: 'condicoesPagamento',
      titulo: 'Condições comerciais / pagamento',
      tipo: 'texto-longo',
    },
    { chave: 'observacoes', titulo: 'Observações da proposta', tipo: 'texto-longo' },
  ],
};
const PADROES: Record<Secao, Record<string, string>> = {
  contas: { segmento: 'outro', classificacao: 'B', status: 'prospect', frequenciaVisitaDias: '30' },
  produtos: { categoria: 'outro', unidade: 'unidade', precoCentavos: '0' },
  oportunidades: { etapa: 'prospeccao', probabilidade: '10', valorCentavos: '0' },
  atividades: { tipo: 'visita', canal: 'presencial', status: 'planejada' },
  propostas: { status: 'rascunho' },
};
const SINGULAR: Record<Secao, string> = {
  contas: 'conta',
  produtos: 'produto',
  oportunidades: 'oportunidade',
  atividades: 'atividade',
  propostas: 'proposta',
};
function valoresIniciais(secao: Secao, registro?: Registro | null) {
  const valores = { ...PADROES[secao] };
  for (const c of CAMPOS[secao]) {
    const v = registro ? (registro as unknown as Record<string, unknown>)[c.chave] : undefined;
    if (v == null) continue;
    if (c.tipo === 'dinheiro') valores[c.chave] = String(Number(v) / 100);
    else if (c.tipo === 'horario' && typeof v === 'string') {
      const d = new Date(v);
      valores[c.chave] = new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
        .toISOString()
        .slice(0, 16);
    } else if (c.tipo === 'data') valores[c.chave] = String(v).slice(0, 10);
    else valores[c.chave] = String(v);
  }
  return valores;
}
export function Modal({
  titulo,
  children,
  aoFechar,
  bloqueado = false,
  largo = false,
}: {
  titulo: string;
  children: ReactNode;
  aoFechar: () => void;
  bloqueado?: boolean;
  largo?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.querySelector<HTMLElement>('input,select,textarea,button')?.focus();
    return () => {
      document.body.style.overflow = overflow;
      anterior?.focus();
    };
  }, []);
  return (
    <div className="tv-modal-backdrop">
      <div
        ref={ref}
        className={`tv-modal ${largo ? 'tv-modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && !bloqueado) aoFechar();
          if (e.key !== 'Tab') return;
          const focaveis = Array.from(
            ref.current?.querySelectorAll<HTMLElement>(
              'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]',
            ) ?? [],
          );
          const primeiro = focaveis[0];
          const ultimo = focaveis.at(-1);
          if (e.shiftKey && document.activeElement === primeiro) {
            e.preventDefault();
            ultimo?.focus();
          } else if (!e.shiftKey && document.activeElement === ultimo) {
            e.preventDefault();
            primeiro?.focus();
          }
        }}
      >
        <div className="tv-modal-header">
          <div>
            <span className="tv-eyebrow">TELA VIVA · CARTEIRA COMERCIAL</span>
            <h2 id={id}>{titulo}</h2>
          </div>
          <button
            type="button"
            className="tv-icon-button"
            aria-label="Fechar formulário"
            disabled={bloqueado}
            onClick={aoFechar}
          >
            <Icone nome="fechar" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function EditorRegistro({
  secao,
  registro,
  inicial,
  aoFechar,
  aoSalvar,
}: {
  secao: Secao;
  registro?: Registro | null;
  inicial?: Record<string, string>;
  aoFechar: () => void;
  aoSalvar: (r: Registro) => void;
}) {
  const [valores, setValores] = useState<Record<string, string>>(() => ({
    ...valoresIniciais(secao, registro),
    contatoId: registro?.contatoId ?? '',
    ...inicial,
  }));
  const [itens, setItens] = useState<ItemProposta[]>(
    registro?.itens ? structuredClone(registro.itens) : [],
  );
  const [refs, setRefs] = useState<Record<string, Registro[]>>({});
  const [erroRefs, setErroRefs] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [conflito, setConflito] = useState(false);
  const equipe = useEquipe(secao === 'atividades');
  const [responsavelId, setResponsavelId] = useState(registro?.responsavelId ?? '');
  const [colaboradoresIds, setColaboradoresIds] = useState<string[]>(
    registro?.colaboradoresIds ?? [],
  );
  const [responsavelAlterado, setResponsavelAlterado] = useState(false);
  const [colaboradoresAlterados, setColaboradoresAlterados] = useState(false);
  useEffect(() => {
    let vivo = true;
    const secoes = Array.from(
      new Set([
        ...CAMPOS[secao].flatMap((c) => (c.referencia ? [c.referencia] : [])),
        ...(secao === 'propostas' ? ['produtos'] : []),
      ]),
    ) as Secao[];
    void Promise.all(secoes.map(async (s) => [s, await todasReferencias(s)] as const))
      .then((pares) => {
        if (vivo) setRefs(Object.fromEntries(pares));
      })
      .catch((e: unknown) => {
        if (vivo)
          setErroRefs(e instanceof Error ? e.message : 'Não consegui carregar as referências.');
      });
    return () => {
      vivo = false;
    };
  }, [secao]);
  const mudar = (chave: string, valor: string) =>
    setValores((atual) => ({
      ...atual,
      [chave]: valor,
      ...(chave === 'contaId' ? { oportunidadeId: '', contatoId: '' } : {}),
    }));
  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setSalvando(true);
    try {
      const corpo: Record<string, unknown> = {};
      if (secao === 'atividades') {
        if (valores.status === 'concluida' && !valores.resultado?.trim())
          throw new Error('Registre o resultado da atividade antes de marcá-la como concluída.');
        if (responsavelAlterado && responsavelId) {
          if (!equipe.equipe.some((u) => u.id === responsavelId))
            throw new Error('Escolha um responsável da equipe ativa.');
          corpo.responsavelId = responsavelId;
        }
        if (colaboradoresAlterados) {
          if (colaboradoresIds.length > 20) throw new Error('Selecione até 20 colaboradores.');
          if (colaboradoresIds.some((id) => !equipe.equipe.some((u) => u.id === id)))
            throw new Error('Mantenha na nova seleção somente colaboradores da equipe ativa.');
          corpo.colaboradoresIds = colaboradoresIds;
        }
      }
      for (const c of CAMPOS[secao]) {
        const valor = valores[c.chave] ?? '';
        if (c.tipo === 'numero' || c.tipo === 'dinheiro') {
          if (valor !== '')
            corpo[c.chave] =
              c.tipo === 'dinheiro' ? Math.round(Number(valor) * 100) : Number(valor);
        } else if (c.tipo === 'horario')
          corpo[c.chave] = valor ? new Date(valor).toISOString() : null;
        else if (c.tipo === 'data') corpo[c.chave] = valor || null;
        else corpo[c.chave] = valor;
      }
      if (secao === 'propostas') {
        corpo.itens = itens;
        if (valores.contatoId) {
          const pessoa = refs.contas
            ?.find((c) => c._id === valores.contaId)
            ?.pessoas?.find((p) => p.id === valores.contatoId && p.ativo);
          if (!pessoa) throw new Error('Escolha um contato ativo da conta para esta proposta.');
          corpo.contatoId = valores.contatoId;
        } else if (registro?.contatoId) {
          throw new Error(
            'Esta proposta já possui um contato. Escolha um contato ativo para substituí-lo.',
          );
        }
      }
      if (registro) corpo.versao = registro.versao;
      const resposta = await apiComercial<{ registro: Registro }>(
        `/${secao}${registro ? `/${registro._id}` : ''}`,
        registro ? 'PATCH' : 'POST',
        corpo,
      );
      aoSalvar(resposta.registro);
    } catch (e) {
      setErro(
        e instanceof Error
          ? e.message
          : 'Não consegui salvar. Seus campos continuam neste formulário.',
      );
      setConflito(e instanceof ErroComercial && e.status === 409);
    } finally {
      setSalvando(false);
    }
  }
  const subtotal = itens.reduce((n, i) => n + i.quantidade * i.precoUnitarioCentavos, 0);
  const desconto = itens.reduce(
    (n, i) => n + Math.round((i.quantidade * i.precoUnitarioCentavos * i.descontoPercentual) / 100),
    0,
  );
  return (
    <Modal
      titulo={`${registro ? 'Editar' : secao === 'produtos' ? 'Novo' : 'Nova'} ${SINGULAR[secao]}`}
      aoFechar={aoFechar}
      bloqueado={salvando}
      largo={secao === 'propostas'}
    >
      <form onSubmit={(e) => void salvar(e)}>
        <div className="tv-modal-body">
          <p className="tv-form-intro">
            {registro
              ? 'Atualize o relacionamento e mantenha o próximo passo claro.'
              : 'Comece com o que você sabe. Você pode completar os detalhes depois.'}
          </p>
          {erroRefs ? (
            <p className="tv-inline-error" role="alert">
              Referências indisponíveis: {erroRefs}
            </p>
          ) : null}
          {secao === 'atividades' ? (
            <section className="tv-activity-assignment">
              <h3>Responsável e colaboradores</h3>
              {equipe.carregando ? (
                <p className="tv-help-text" role="status">
                  Carregando a equipe ativa…
                </p>
              ) : null}
              {equipe.erro ? (
                <div className="tv-inline-error" role="alert">
                  <p>{equipe.erro}</p>
                  <button className="tv-small-button" type="button" onClick={equipe.atualizar}>
                    Consultar equipe novamente
                  </button>
                </div>
              ) : null}
              <div className="tv-form-grid">
                <label className="tv-field">
                  <span>Responsável pela atividade</span>
                  <select
                    value={responsavelId}
                    disabled={equipe.carregando || Boolean(equipe.erro)}
                    onChange={(e) => {
                      setResponsavelId(e.target.value);
                      setResponsavelAlterado(true);
                    }}
                  >
                    <option value="" disabled={Boolean(registro?.responsavelId)}>
                      Sem responsável definido
                    </option>
                    {responsavelId && !equipe.equipe.some((u) => u.id === responsavelId) ? (
                      <option value={responsavelId} disabled>
                        Responsável atribuído — nome indisponível
                      </option>
                    ) : null}
                    {equipe.equipe.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nome} · {papelUsuario(u.papel)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="tv-field">
                  <span>Colaboradores da atividade</span>
                  <select
                    multiple
                    value={colaboradoresIds}
                    disabled={equipe.carregando || Boolean(equipe.erro)}
                    onChange={(e) => {
                      setColaboradoresIds(Array.from(e.target.selectedOptions, (o) => o.value));
                      setColaboradoresAlterados(true);
                    }}
                  >
                    {colaboradoresIds
                      .filter((id) => !equipe.equipe.some((u) => u.id === id))
                      .map((id) => (
                        <option value={id} key={id}>
                          Colaborador atribuído — nome indisponível
                        </option>
                      ))}
                    {equipe.equipe.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nome} · {papelUsuario(u.papel)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="tv-assignment-help">
                <p className="tv-help-text">
                  Selecione os colaboradores que participam da atividade. No computador, use Ctrl ou
                  Command para selecionar mais de uma pessoa. Atribuições anteriores permanecem
                  quando você altera apenas o resultado.
                </p>
                <button
                  className="tv-small-button"
                  type="button"
                  disabled={equipe.carregando || Boolean(equipe.erro)}
                  onClick={() => {
                    setColaboradoresIds([]);
                    setColaboradoresAlterados(true);
                  }}
                >
                  Limpar colaboradores
                </button>
              </div>
              {!equipe.carregando && !equipe.erro && !equipe.equipe.length ? (
                <p className="tv-help-text">
                  Nenhum membro ativo disponível para atribuição nesta sessão.
                </p>
              ) : null}
            </section>
          ) : null}
          {secao === 'contas' && registro?.contatoOrigemId ? (
            <p className="tv-help-text">
              Nome, WhatsApp, e-mail, cidade, UF e tipo vêm da ficha do contato e se atualizam
              sozinhos. Para mudá-los,{' '}
              <Link to={`/lead/${registro.contatoOrigemId}`}>abra a ficha do contato</Link>.
            </p>
          ) : null}
          <div className="tv-form-grid">
            {CAMPOS[secao]
              .filter(
                (c) =>
                  !(secao === 'contas' && registro?.contatoOrigemId && ESPELHADOS.has(c.chave)),
              )
              .map((c) => {
                const valor = valores[c.chave] ?? '';
                const opcoes = c.referencia
                  ? (refs[c.referencia] ?? []).filter(
                      (r) =>
                        c.referencia !== 'oportunidades' ||
                        !valores.contaId ||
                        r.contaId === valores.contaId,
                    )
                  : [];
                return (
                  <label
                    key={c.chave}
                    className={`tv-field ${c.amplo || c.tipo === 'texto-longo' ? 'tv-field-wide' : ''}`}
                  >
                    <span>{c.titulo}</span>
                    {c.opcoes ? (
                      <select value={valor} onChange={(e) => mudar(c.chave, e.target.value)}>
                        {c.opcoes.map((o) => (
                          <option key={o} value={o}>
                            {rotulo(o)}
                          </option>
                        ))}
                      </select>
                    ) : c.referencia ? (
                      <select value={valor} onChange={(e) => mudar(c.chave, e.target.value)}>
                        <option value="">Sem vínculo por enquanto</option>
                        {valor && !opcoes.some((o) => o._id === valor) ? (
                          <option value={valor}>Vínculo atual</option>
                        ) : null}
                        {opcoes.map((o) => (
                          <option value={o._id} key={o._id}>
                            {nomeRegistro(o)}
                          </option>
                        ))}
                      </select>
                    ) : c.tipo === 'texto-longo' ? (
                      <textarea
                        value={valor}
                        rows={3}
                        maxLength={4000}
                        onChange={(e) => mudar(c.chave, e.target.value)}
                      />
                    ) : (
                      <input
                        type={
                          c.tipo === 'numero' || c.tipo === 'dinheiro'
                            ? 'number'
                            : c.tipo === 'horario'
                              ? 'datetime-local'
                              : c.tipo === 'data'
                                ? 'date'
                                : 'text'
                        }
                        value={valor}
                        maxLength={c.chave === 'uf' ? 2 : 500}
                        step={c.tipo === 'dinheiro' ? '0.01' : '1'}
                        min={c.tipo === 'numero' || c.tipo === 'dinheiro' ? 0 : undefined}
                        onChange={(e) => mudar(c.chave, e.target.value)}
                      />
                    )}
                  </label>
                );
              })}
          </div>
          {secao === 'propostas' ? (
            <div className="tv-proposal-contact">
              <label className="tv-field">
                <span>Contato destinatário da proposta</span>
                <select
                  value={valores.contatoId ?? ''}
                  onChange={(e) => mudar('contatoId', e.target.value)}
                >
                  <option value="">Usar contato principal do cadastro</option>
                  {valores.contatoId &&
                  !refs.contas
                    ?.find((c) => c._id === valores.contaId)
                    ?.pessoas?.some((p) => p.id === valores.contatoId && p.ativo) ? (
                    <option value={valores.contatoId}>
                      Contato vinculado indisponível — escolha outro
                    </option>
                  ) : null}
                  {(refs.contas?.find((c) => c._id === valores.contaId)?.pessoas ?? [])
                    .filter((p) => p.ativo)
                    .map((p) => (
                      <option value={p.id} key={p.id}>
                        {p.nome || p.email || 'Contato sem nome'}
                        {p.cargo ? ` · ${p.cargo}` : ''}
                        {p.principal ? ' · padrão' : ''}
                      </option>
                    ))}
                </select>
              </label>
              <p className="tv-help-text">
                Selecione a conta acima para escolher um de seus contatos ativos. A proposta só
                prepara um rascunho no seu aplicativo de e-mail; não envia mensagens.
              </p>
            </div>
          ) : null}
          {secao === 'propostas' ? (
            <section className="tv-quote-editor">
              <div className="tv-section-heading">
                <div>
                  <h3>Itens da proposta</h3>
                  <p>Selecione um produto ou descreva um item comercial.</p>
                </div>
                <button
                  className="tv-button tv-button-light"
                  type="button"
                  disabled={itens.length >= 100}
                  onClick={() =>
                    setItens([
                      ...itens,
                      {
                        produtoId: '',
                        descricao: '',
                        quantidade: 1,
                        precoUnitarioCentavos: 0,
                        descontoPercentual: 0,
                      },
                    ])
                  }
                >
                  <Icone nome="mais" />
                  Adicionar item
                </button>
              </div>
              {itens.map((item, idx) => {
                const alterar = (patch: Partial<ItemProposta>) =>
                  setItens((atuais) => atuais.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
                return (
                  <fieldset key={idx} className="tv-quote-line">
                    <legend>Item {idx + 1}</legend>
                    <div className="tv-form-grid">
                      <label className="tv-field">
                        <span>Produto do catálogo</span>
                        <select
                          value={item.produtoId ?? ''}
                          onChange={(e) => {
                            const p = refs.produtos?.find((r) => r._id === e.target.value);
                            alterar({
                              produtoId: e.target.value,
                              ...(p
                                ? {
                                    descricao: p.nome ?? '',
                                    precoUnitarioCentavos: p.precoCentavos ?? 0,
                                  }
                                : {}),
                            });
                          }}
                        >
                          <option value="">Item descrito manualmente</option>
                          {item.produtoId &&
                          !refs.produtos?.some((p) => p._id === item.produtoId) ? (
                            <option value={item.produtoId}>Produto atual</option>
                          ) : null}
                          {refs.produtos?.map((p) => (
                            <option key={p._id} value={p._id}>
                              {nomeRegistro(p)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="tv-field">
                        <span>Descrição do item {idx + 1}</span>
                        <input
                          value={item.descricao}
                          maxLength={500}
                          onChange={(e) => alterar({ descricao: e.target.value })}
                        />
                      </label>
                    </div>
                    <div className="tv-quote-numbers">
                      <label className="tv-field">
                        <span>Quantidade</span>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          max="1000000"
                          value={item.quantidade}
                          onChange={(e) => alterar({ quantidade: Number(e.target.value) })}
                        />
                      </label>
                      <label className="tv-field">
                        <span>Preço unitário (R$)</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.precoUnitarioCentavos / 100}
                          onChange={(e) =>
                            alterar({
                              precoUnitarioCentavos: Math.round(Number(e.target.value) * 100),
                            })
                          }
                        />
                      </label>
                      <label className="tv-field">
                        <span>Desconto (%)</span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={item.descontoPercentual}
                          onChange={(e) => alterar({ descontoPercentual: Number(e.target.value) })}
                        />
                      </label>
                      <button
                        type="button"
                        className="tv-icon-button tv-danger"
                        aria-label={`Remover item ${idx + 1}`}
                        onClick={() => setItens(itens.filter((_, i) => i !== idx))}
                      >
                        <Icone nome="fechar" />
                      </button>
                    </div>
                  </fieldset>
                );
              })}
              {!itens.length ? (
                <p className="tv-form-intro">
                  Nenhum item adicionado. Você pode salvar um rascunho e completar depois.
                </p>
              ) : null}
              <div className="tv-quote-totals">
                <span>
                  Subtotal <strong>{moeda(subtotal)}</strong>
                </span>
                <span>
                  Descontos <strong>{moeda(desconto)}</strong>
                </span>
                <span className="tv-total">
                  Total estimado <strong>{moeda(subtotal - desconto)}</strong>
                </span>
                <small>O servidor confirma os valores ao salvar.</small>
              </div>
            </section>
          ) : null}
          {erro ? (
            <div className="tv-inline-error" role="alert">
              <strong>A alteração não foi confirmada.</strong>
              <p>{erro}</p>
              {conflito ? (
                <p>
                  Seus campos foram preservados. Anote as alterações e reabra o registro para
                  comparar com a versão atual antes de salvar.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="tv-modal-footer">
          <span>Gravação na carteira online</span>
          <button
            className="tv-button tv-button-light"
            type="button"
            disabled={salvando}
            onClick={aoFechar}
          >
            Cancelar
          </button>
          <button
            className="tv-button tv-button-primary"
            type="submit"
            disabled={salvando || conflito}
          >
            {salvando ? 'Confirmando…' : 'Salvar na carteira'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
