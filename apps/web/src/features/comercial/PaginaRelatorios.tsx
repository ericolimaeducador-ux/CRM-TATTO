import { useEffect, useState, type FormEvent } from 'react';
import { perfilLogado } from '@/lib/offline/sessao';
import {
  dataFormatada,
  ETAPAS,
  moeda,
  papelUsuario,
  rotulo,
  temSessao,
  useComercial,
  useEquipe,
} from './api';
import { AvisoDados, CabecalhoPagina, Icone, Vazio } from './componentes';

interface RelatorioComercial {
  periodo: { de: string; ate: string; representanteId?: string };
  baseJanela: { atividades: string; demais: string };
  atividades: {
    total: number;
    porTipo: { tipo: string; quantidade: number }[];
    porStatus: { status: string; quantidade: number }[];
  };
  oportunidades: {
    total: number;
    pipelineCentavos: number;
    porEtapa: { etapa: string; quantidade: number; valorCentavos: number }[];
  };
  propostas: {
    total: number;
    totalCentavos: number;
    porStatus: { status: string; quantidade: number; totalCentavos: number }[];
  };
  treinamentos: { quantidade: number };
  contatos?: { total: number; porDia: { dia: string; quantidade: number }[] };
  participantes: { inscricoes: number; confirmados: number; presentes: number };
}
const quantidade = (n: number) => new Intl.NumberFormat('pt-BR').format(n);
function dataLocal(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}
function periodoInicial() {
  const ate = new Date();
  const de = new Date(ate);
  de.setDate(de.getDate() - 29);
  return { de: dataLocal(de), ate: dataLocal(ate) };
}
function dataValida(valor: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const data = new Date(`${valor}T00:00:00Z`);
  return Number.isFinite(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}
const nomeGrupo = (valor: string) => (valor === 'nao_informado' ? 'Não informado' : rotulo(valor));

export function PaginaRelatorios() {
  const [inicial] = useState(periodoInicial);
  const [de, setDe] = useState(inicial.de);
  const [ate, setAte] = useState(inicial.ate);
  const [representanteId, setRepresentanteId] = useState('');
  const [erroFiltro, setErroFiltro] = useState('');
  const [consulta, setConsulta] = useState(() => new URLSearchParams(inicial).toString());
  const papel = perfilLogado()?.papel;
  const gestao = papel === 'gestor' || papel === 'admin';
  const equipe = useEquipe(gestao);
  const relatorio = useComercial<RelatorioComercial>(`/relatorios?${consulta}`);
  const r = relatorio.dados;
  useEffect(() => {
    if (gestao) return;
    setRepresentanteId('');
    setConsulta((atual) => {
      const q = new URLSearchParams(atual);
      q.delete('representanteId');
      return q.toString();
    });
  }, [gestao]);
  function consultar(e: FormEvent) {
    e.preventDefault();
    setErroFiltro('');
    if (!dataValida(de) || !dataValida(ate)) {
      setErroFiltro('Informe datas válidas para o início e o fim do período.');
      return;
    }
    if (de > ate) {
      setErroFiltro('A data inicial precisa ser anterior ou igual à data final.');
      return;
    }
    const dias = (Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000 + 1;
    if (dias > 366) {
      setErroFiltro('Escolha um período de até 366 dias, incluindo o primeiro e o último dia.');
      return;
    }
    if (gestao && representanteId && !equipe.equipe.some((u) => u.id === representanteId)) {
      setErroFiltro(
        'Selecione um membro disponível no diretório da equipe ou consulte todas as carteiras.',
      );
      return;
    }
    const q = new URLSearchParams({
      de,
      ate,
      ...(gestao && representanteId ? { representanteId } : {}),
    }).toString();
    if (q === consulta) relatorio.atualizar();
    else setConsulta(q);
  }
  const pronto = temSessao() && !relatorio.carregando && !relatorio.erro && r;
  const vazio = Boolean(
    r &&
    r.atividades.total +
      r.oportunidades.total +
      r.propostas.total +
      r.treinamentos.quantidade +
      r.participantes.inscricoes +
      (r.contatos?.total ?? 0) ===
      0,
  );
  const escopo =
    papel === 'vendedor'
      ? 'Sua carteira'
      : papel === 'auditor'
        ? 'Visão consolidada de auditoria'
        : gestao
          ? r?.periodo.representanteId
            ? 'Carteira selecionada'
            : 'Carteiras consolidadas'
          : 'Dados autorizados pela sessão';
  const cards = [
    {
      titulo: 'Contatos capturados',
      valor: r?.contatos?.total,
      icone: 'contatos',
      cor: 'azul',
      detalhe: 'Soma dos contatos que entraram no período',
    },
    {
      titulo: 'Atividades agendadas',
      valor: r?.atividades.total,
      icone: 'agenda',
      cor: 'verde',
      detalhe: 'Pela data marcada na atividade',
    },
    {
      titulo: 'Oportunidades criadas',
      valor: r?.oportunidades.total,
      icone: 'funil',
      cor: 'azul',
      detalhe: 'Cadastros criados no período',
    },
    {
      titulo: 'Valor do funil aberto',
      valor: r ? moeda(r.oportunidades.pipelineCentavos) : undefined,
      icone: 'grafico',
      cor: 'ambar',
      detalhe: 'Oportunidades fora de ganho e perda',
    },
    {
      titulo: 'Valor das propostas',
      valor: r ? moeda(r.propostas.totalCentavos) : undefined,
      icone: 'propostas',
      cor: 'roxo',
      detalhe: 'Soma de todas as situações',
    },
  ];
  return (
    <div className="tv-page">
      <CabecalhoPagina
        titulo="Relatórios comerciais"
        descricao="Acompanhe a atividade comercial e a participação em treinamentos com indicadores agregados."
      />
      <section className="tv-panel">
        <div className="tv-panel-heading">
          <div>
            <h2>Período e carteira</h2>
            <p>Consulta inicial dos últimos 30 dias. Janela máxima de 366 dias.</p>
          </div>
          <Icone nome="grafico" />
        </div>
        <form className="tv-report-filters" onSubmit={consultar} noValidate>
          <label className="tv-field">
            <span>Data inicial do relatório</span>
            <input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          </label>
          <label className="tv-field">
            <span>Data final do relatório</span>
            <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          </label>
          {gestao ? (
            <label className="tv-field">
              <span>Representante / responsável pela carteira</span>
              <select
                value={representanteId}
                disabled={equipe.carregando || Boolean(equipe.erro)}
                onChange={(e) => setRepresentanteId(e.target.value)}
              >
                <option value="">Todas as carteiras</option>
                {representanteId && !equipe.equipe.some((u) => u.id === representanteId) ? (
                  <option value={representanteId}>Seleção anterior indisponível</option>
                ) : null}
                {equipe.equipe
                  .filter((u) => ['vendedor', 'gestor', 'admin'].includes(u.papel ?? ''))
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome} · {papelUsuario(u.papel)}
                    </option>
                  ))}
              </select>
            </label>
          ) : null}
          <button
            className="tv-button tv-button-primary"
            type="submit"
            disabled={relatorio.carregando}
          >
            {relatorio.carregando ? 'Consultando…' : 'Consultar relatório'}
          </button>
        </form>
        {erroFiltro ? (
          <p className="tv-inline-error tv-report-filter-error" role="alert">
            {erroFiltro}
          </p>
        ) : null}
        {gestao && equipe.carregando ? (
          <p className="tv-help-text tv-report-scope" role="status">
            Carregando o diretório da equipe…
          </p>
        ) : null}
        {gestao && equipe.erro ? (
          <div className="tv-inline-error tv-report-filter-error" role="alert">
            <p>
              O filtro de representante está indisponível. A consulta consolidada continua
              disponível.
            </p>
            <button type="button" className="tv-small-button" onClick={equipe.atualizar}>
              Carregar equipe novamente
            </button>
            {representanteId ? (
              <button
                type="button"
                className="tv-small-button"
                onClick={() => setRepresentanteId('')}
              >
                Limpar seleção de representante
              </button>
            ) : null}
          </div>
        ) : null}
        <p className="tv-help-text tv-report-scope">
          {papel === 'vendedor'
            ? 'O relatório usa somente os registros da sua carteira.'
            : papel === 'auditor'
              ? 'A auditoria consulta os totais consolidados, sem filtro individual de representante.'
              : 'A consulta apresenta totais agregados. Nenhum contato ou participante individual é exibido.'}
        </p>
      </section>
      <AvisoDados
        erro={relatorio.erro}
        carregando={relatorio.carregando}
        atualizar={relatorio.atualizar}
      />
      {pronto ? (
        <>
          <div className="tv-report-applied">
            <div>
              <span className="tv-eyebrow">PERÍODO CONSULTADO</span>
              <strong>
                {dataFormatada(r.periodo.de)} a {dataFormatada(r.periodo.ate)}
              </strong>
            </div>
            <span>{escopo}</span>
          </div>
          <div className="tv-kpi-grid">
            {cards.map((c) => (
              <article className="tv-kpi" key={c.titulo}>
                <div className="tv-kpi-top">
                  <span>{c.titulo}</span>
                  <span className={`tv-kpi-icon ${c.cor}`}>
                    <Icone nome={c.icone} />
                  </span>
                </div>
                <strong>{typeof c.valor === 'number' ? quantidade(c.valor) : c.valor}</strong>
                <small>{c.detalhe}</small>
              </article>
            ))}
          </div>
          {vazio ? (
            <section className="tv-panel">
              <Vazio
                titulo="Nenhum registro nesta janela de consulta."
                texto="Experimente outro período ou, quando seu perfil permitir, outra carteira. Os valores abaixo representam os totais reais retornados pelo servidor."
              />
            </section>
          ) : null}
          <ContatosPorDia contatos={r.contatos} />
          <div className="tv-dashboard-grid tv-report-grid">
            <ResumoContagens
              titulo="Atividades por tipo"
              descricao="Distribuição das atividades com data marcada no período."
              linhas={r.atividades.porTipo.map((l) => ({
                grupo: nomeGrupo(l.tipo),
                quantidade: l.quantidade,
              }))}
            />
            <ResumoContagens
              titulo="Atividades por situação"
              descricao="Situação atual das atividades agendadas nessa janela."
              linhas={r.atividades.porStatus.map((l) => ({
                grupo: nomeGrupo(l.status),
                quantidade: l.quantidade,
              }))}
            />
          </div>
          <div className="tv-dashboard-grid tv-report-grid">
            <section className="tv-panel">
              <div className="tv-panel-heading">
                <div>
                  <h2>Oportunidades por etapa</h2>
                  <p>
                    {quantidade(r.oportunidades.total)} oportunidades criadas no período, na etapa
                    atual.
                  </p>
                </div>
              </div>
              {r.oportunidades.porEtapa.length ? (
                <div className="tv-table-scroll">
                  <table className="tv-table">
                    <thead>
                      <tr>
                        <th>Etapa atual</th>
                        <th>Quantidade</th>
                        <th>Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...r.oportunidades.porEtapa]
                        .sort((a, b) => {
                          const ia = ETAPAS.indexOf(a.etapa);
                          const ib = ETAPAS.indexOf(b.etapa);
                          return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
                        })
                        .map((l) => (
                          <tr key={l.etapa}>
                            <td>{nomeGrupo(l.etapa)}</td>
                            <td>{quantidade(l.quantidade)}</td>
                            <td>
                              <strong>{moeda(l.valorCentavos)}</strong>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="tv-report-no-data">Nenhuma oportunidade criada no período.</p>
              )}
            </section>
            <section className="tv-panel">
              <div className="tv-panel-heading">
                <div>
                  <h2>Propostas por situação</h2>
                  <p>
                    {quantidade(r.propostas.total)} propostas criadas no período. Os valores não
                    representam receita realizada.
                  </p>
                </div>
              </div>
              {r.propostas.porStatus.length ? (
                <div className="tv-table-scroll">
                  <table className="tv-table">
                    <thead>
                      <tr>
                        <th>Situação atual</th>
                        <th>Quantidade</th>
                        <th>Valor total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.propostas.porStatus.map((l) => (
                        <tr key={l.status}>
                          <td>{nomeGrupo(l.status)}</td>
                          <td>{quantidade(l.quantidade)}</td>
                          <td>
                            <strong>{moeda(l.totalCentavos)}</strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="tv-report-no-data">Nenhuma proposta criada no período.</p>
              )}
            </section>
          </div>
          <section className="tv-panel">
            <div className="tv-panel-heading">
              <div>
                <h2>Treinamentos e participação</h2>
                <p>Cadastros criados no período e sua situação atual de confirmação e presença.</p>
              </div>
            </div>
            <dl className="tv-report-participation">
              <div>
                <dt>Treinamentos criados</dt>
                <dd>{quantidade(r.treinamentos.quantidade)}</dd>
              </div>
              <div>
                <dt>Inscrições registradas</dt>
                <dd>{quantidade(r.participantes.inscricoes)}</dd>
              </div>
              <div>
                <dt>Inscrições confirmadas</dt>
                <dd>{quantidade(r.participantes.confirmados)}</dd>
              </div>
              <div>
                <dt>Presenças registradas</dt>
                <dd>{quantidade(r.participantes.presentes)}</dd>
              </div>
            </dl>
          </section>
          <aside className="tv-report-method">
            <Icone nome="relogio" />
            <div>
              <h2>Como o período é aplicado</h2>
              <p>
                Atividades: {r.baseJanela.atividades}. Demais indicadores: {r.baseJanela.demais}. As
                datas são dias civis de São Paulo (America/Sao_Paulo), incluindo a data inicial e a
                final. Apenas registros não arquivados entram na consulta.
              </p>
              <p>
                Os quadros mostram totais e situações atuais dentro dessa base de datas. A leitura é
                registrada na auditoria; nenhuma informação pessoal é exportada por esta tela.
              </p>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}
function ResumoContagens({
  titulo,
  descricao,
  linhas,
}: {
  titulo: string;
  descricao: string;
  linhas: { grupo: string; quantidade: number }[];
}) {
  const max = Math.max(1, ...linhas.map((l) => l.quantidade));
  return (
    <section className="tv-panel">
      <div className="tv-panel-heading">
        <div>
          <h2>{titulo}</h2>
          <p>{descricao}</p>
        </div>
      </div>
      {linhas.length ? (
        <div className="tv-report-bars">
          {linhas.map((l) => (
            <div className="tv-report-bar" key={l.grupo}>
              <div>
                <span>{l.grupo}</span>
                <strong>{quantidade(l.quantidade)}</strong>
              </div>
              <div className="tv-bar-track" aria-hidden="true">
                <span style={{ width: `${(l.quantidade / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="tv-report-no-data">Nenhuma atividade agendada no período.</p>
      )}
    </section>
  );
}
function ContatosPorDia({ contatos }: { contatos: RelatorioComercial['contatos'] }) {
  if (!contatos) return null;
  return (
    <section className="tv-panel" data-testid="contatos-por-dia">
      <div className="tv-panel-heading">
        <div>
          <h2>Contatos capturados por dia</h2>
          <p>
            {quantidade(contatos.total)} contatos entraram no período (QR, digitação e importação),
            pela data de entrada.
          </p>
        </div>
      </div>
      {contatos.porDia.length ? (
        <div className="tv-table-scroll">
          <table className="tv-table">
            <thead>
              <tr>
                <th>Dia</th>
                <th>Contatos capturados</th>
              </tr>
            </thead>
            <tbody>
              {[...contatos.porDia].reverse().map((l) => (
                <tr key={l.dia}>
                  <td>{dataFormatada(l.dia)}</td>
                  <td>
                    <strong>{quantidade(l.quantidade)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th>Total do período</th>
                <th>{quantidade(contatos.total)}</th>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p className="tv-report-no-data">Nenhum contato capturado no período.</p>
      )}
    </section>
  );
}
