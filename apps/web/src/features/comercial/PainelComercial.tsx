import { Link } from 'react-router-dom';
import { perfilLogado } from '@/lib/offline/sessao';
import {
  dataFormatada,
  moeda,
  nomeRegistro,
  rotulo,
  temSessao,
  useComercial,
  type Painel,
} from './api';
import { AvisoDados, CabecalhoPagina, CapturaRapida, Icone, Selo, Vazio } from './componentes';

export function PainelComercial() {
  const { dados, erro, carregando, atualizar } = useComercial<Painel>('/painel');
  const nome = perfilLogado()?.nome.split(' ')[0];
  const pronto = Boolean(dados && !erro && !carregando);
  const i = dados?.indicadores;
  const cards = [
    {
      nome: 'Contas na carteira',
      valor: i?.contas,
      detalhe: 'Relacionamentos em construção',
      icone: 'contas',
      cor: 'verde',
    },
    {
      nome: 'Visitas de hoje',
      valor: i?.visitasHoje,
      detalhe: 'Presença que faz a diferença',
      icone: 'agenda',
      cor: 'azul',
    },
    {
      nome: 'Oportunidades abertas',
      valor: i?.oportunidadesAbertas,
      detalhe: 'Conversas que podem crescer',
      icone: 'funil',
      cor: 'ambar',
    },
    {
      nome: 'Valor do funil',
      valor: i ? moeda(i.pipelineCentavos) : undefined,
      detalhe: 'Potencial comercial em aberto',
      icone: 'grafico',
      cor: 'roxo',
    },
  ];
  const funil = dados?.funil.filter((f) => !['ganho', 'perdido'].includes(f.etapa)) ?? [];
  const max = Math.max(1, ...funil.map((f) => f.valorCentavos));
  return (
    <div className="tv-page">
      <CabecalhoPagina
        sobrancelha={new Intl.DateTimeFormat('pt-BR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })
          .format(new Date())
          .toUpperCase()}
        titulo={nome ? `Bom ter você aqui, ${nome}.` : 'Seu dia, em movimento.'}
        descricao="Cada visita aproxima. Cada conexão abre uma nova possibilidade."
        acao={
          <Link className="tv-button tv-button-primary" to="/agenda?novo=1">
            <Icone nome="mais" />
            Agendar visita
          </Link>
        }
      />
      <div className="tv-welcome-strip">
        <div>
          <span className="tv-eyebrow">CONEXÕES QUE VIRAM OPORTUNIDADES</span>
          <h2>Cuidado em cada conexão.</h2>
          <p>Sua carteira, suas visitas e os próximos passos da Tela Viva.</p>
        </div>
        <div className="tv-welcome-art" aria-hidden="true">
          <span />
          <span />
          <span />
          <Icone nome="grafico" tamanho={58} />
        </div>
      </div>
      <AvisoDados erro={erro} carregando={carregando} atualizar={atualizar} />
      <div className="tv-kpi-grid">
        {cards.map((c) => (
          <article className="tv-kpi" key={c.nome}>
            <div className="tv-kpi-top">
              <span>{c.nome}</span>
              <span className={`tv-kpi-icon ${c.cor}`}>
                <Icone nome={c.icone} />
              </span>
            </div>
            <strong>{pronto ? c.valor : '—'}</strong>
            <small>
              {pronto
                ? c.detalhe
                : temSessao()
                  ? 'Aguardando dados da carteira'
                  : 'Disponível ao entrar'}
            </small>
          </article>
        ))}
      </div>
      <div className="tv-dashboard-grid">
        <section className="tv-panel">
          <div className="tv-panel-heading">
            <div>
              <h2>Próximos encontros</h2>
              <p>Uma boa visita começa com um bom plano.</p>
            </div>
            <Link to="/agenda" className="tv-text-link">
              Ver agenda
              <Icone nome="seta" tamanho={16} />
            </Link>
          </div>
          {pronto && dados?.proximasAtividades.length ? (
            <div className="tv-activity-list">
              {dados.proximasAtividades.map((a) => (
                <Link key={a._id} to={`/agenda?editar=${a._id}`} className="tv-activity">
                  <span
                    className={`tv-activity-icon ${a.data && new Date(a.data) < new Date() ? 'atrasada' : ''}`}
                  >
                    <Icone nome={a.tipo === 'visita' ? 'local' : 'relogio'} />
                  </span>
                  <div>
                    <strong>{nomeRegistro(a)}</strong>
                    <small>
                      {rotulo(a.tipo)} <span>·</span> {dataFormatada(a.data, true)}
                    </small>
                  </div>
                  <Selo valor={a.status}>{rotulo(a.status)}</Selo>
                </Link>
              ))}
            </div>
          ) : (
            <Vazio
              titulo="Sua agenda tem espaço para novas conexões."
              texto={
                pronto
                  ? 'Agende uma visita ou registre a próxima ação com um cliente.'
                  : 'Seus compromissos aparecem aqui quando a carteira estiver conectada.'
              }
              acao={
                <Link to="/agenda?novo=1" className="tv-text-link">
                  Planejar uma visita
                  <Icone nome="seta" tamanho={16} />
                </Link>
              }
            />
          )}
        </section>
        <section className="tv-panel">
          <div className="tv-panel-heading">
            <div>
              <h2>Seu funil comercial</h2>
              <p>Da primeira conversa à parceria.</p>
            </div>
            <Link to="/oportunidades" className="tv-icon-button" aria-label="Abrir oportunidades">
              <Icone nome="seta" />
            </Link>
          </div>
          {pronto ? (
            <div className="tv-funnel-chart">
              {funil.map((f, idx) => (
                <div className="tv-funnel-row" key={f.etapa}>
                  <div>
                    <span>
                      <i
                        style={{
                          background: ['#7c8b6c', '#a0ad8e', '#bcbea5', '#cdbb9f', '#e3d5c3'][idx],
                        }}
                      />
                      {rotulo(f.etapa)}
                    </span>
                    <strong>{f.quantidade}</strong>
                  </div>
                  <div className="tv-bar-track">
                    <span
                      style={{
                        width: `${Math.max(f.valorCentavos > 0 ? 3 : 0, (f.valorCentavos / max) * 100)}%`,
                      }}
                    />
                  </div>
                  <small>{moeda(f.valorCentavos)}</small>
                </div>
              ))}
              <div className="tv-funnel-total">
                <span>Negócios ganhos</span>
                <strong>{moeda(i?.ganhoCentavos)}</strong>
              </div>
            </div>
          ) : (
            <Vazio
              titulo="Visualize suas próximas conquistas."
              texto="A evolução das oportunidades será mostrada com os valores reais da sua carteira."
            />
          )}
        </section>
      </div>
      <div className="tv-dashboard-grid tv-dashboard-bottom">
        <section className="tv-panel">
          <div className="tv-panel-heading">
            <div>
              <h2>Relacionamentos recentes</h2>
              <p>Continue de onde a última conversa parou.</p>
            </div>
            <Link className="tv-text-link" to="/carteira">
              Ver carteira
              <Icone nome="seta" tamanho={16} />
            </Link>
          </div>
          {pronto && dados?.contasRecentes.length ? (
            <div className="tv-recent-accounts">
              {dados.contasRecentes.map((c) => (
                <Link to={`/carteira/${c._id}`} key={c._id}>
                  <span className="tv-account-monogram">
                    {nomeRegistro(c).slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <strong>{nomeRegistro(c)}</strong>
                    <small>
                      {rotulo(c.segmento)}
                      {c.cidade ? ` · ${c.cidade}` : ''}
                    </small>
                  </div>
                  <Selo valor={c.classificacao}>Classe {c.classificacao ?? 'B'}</Selo>
                </Link>
              ))}
            </div>
          ) : (
            <Vazio
              titulo="Sua próxima parceria começa aqui."
              texto="Organize os clientes e instituições que fazem parte da sua atuação."
              acao={
                <Link to="/carteira?novo=1" className="tv-button tv-button-light">
                  <Icone nome="mais" />
                  Adicionar conta
                </Link>
              }
            />
          )}
        </section>
        <section className="tv-capture-card">
          <span className="tv-eyebrow">NO MOMENTO CERTO</span>
          <span className="tv-capture-icon">
            <Icone nome="qr" tamanho={32} />
          </span>
          <h2>
            Conheceu alguém?
            <br />
            Guarde essa conexão.
          </h2>
          <p>
            Capture um contato por QR ou digitação. Sem campos obrigatórios, mesmo sem internet.
          </p>
          <CapturaRapida />
          <Link to="/contatos" className="tv-text-link">
            Ver contatos capturados
            <Icone nome="seta" tamanho={16} />
          </Link>
        </section>
      </div>
      {pronto && (i?.atrasadas ?? 0) > 0 ? (
        <Link to="/agenda?status=planejada" className="tv-notice">
          <Icone nome="relogio" />
          {i?.atrasadas} {i?.atrasadas === 1 ? 'ação aguarda' : 'ações aguardam'} sua atenção.
          Reorganize seus próximos passos.
        </Link>
      ) : null}
    </div>
  );
}
