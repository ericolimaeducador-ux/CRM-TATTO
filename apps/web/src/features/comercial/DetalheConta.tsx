import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  dataFormatada,
  moeda,
  nomeRegistro,
  podeEscrever,
  rotulo,
  useComercial,
  type Evento,
  type Lista,
  type Registro,
} from './api';
import { AvisoDados, CabecalhoPagina, Icone, Selo, Vazio } from './componentes';
import { EditorRegistro } from './EditorRegistro';
import { ContatosConta } from './ContatosConta';

export function DetalheConta() {
  const { id = '' } = useParams();
  const conta = useComercial<{ registro: Registro }>(`/contas/${id}`);
  const atividades = useComercial<Lista>(`/atividades?contaId=${id}&limite=100`);
  const oportunidades = useComercial<Lista>(`/oportunidades?contaId=${id}&limite=100`);
  const trilha = useComercial<{ eventos: Evento[] }>(`/contas/${id}/auditoria`);
  const [editando, setEditando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const r = conta.dados?.registro;
  return (
    <div className="tv-page">
      <Link className="tv-back-link" to="/carteira">
        ← Voltar para a carteira
      </Link>
      <CabecalhoPagina
        titulo={r ? nomeRegistro(r) : 'Relacionamento em detalhe'}
        descricao={
          r
            ? [
                rotulo(r.segmento),
                r.especialidade,
                r.cidade && `${r.cidade}${r.uf ? ` / ${r.uf}` : ''}`,
              ]
                .filter(Boolean)
                .join(' · ')
            : 'O contexto que ajuda você a preparar a próxima conversa.'
        }
        acao={
          r ? (
            <span className="tv-row-actions">
              {r.contatoOrigemId ? (
                <Link className="tv-button tv-button-light" to={`/lead/${r.contatoOrigemId}`}>
                  Abrir ficha do contato
                </Link>
              ) : null}
              {podeEscrever() ? (
                <button className="tv-button tv-button-light" onClick={() => setEditando(true)}>
                  Editar conta
                </button>
              ) : null}
            </span>
          ) : undefined
        }
      />
      <AvisoDados erro={conta.erro} carregando={conta.carregando} atualizar={conta.atualizar} />
      {mensagem ? (
        <p className="tv-success" role="status">
          <Icone nome="check" />
          {mensagem}
        </p>
      ) : null}
      {r ? (
        <>
          <div className="tv-account-summary">
            <span className="tv-account-monogram tv-monogram-large">
              {nomeRegistro(r).slice(0, 2).toUpperCase()}
            </span>
            <div>
              <span className="tv-eyebrow">CONTA DA CARTEIRA</span>
              <h2>{nomeRegistro(r)}</h2>
              <div className="tv-summary-badges">
                <Selo valor={r.classificacao}>Classe {r.classificacao ?? 'B'}</Selo>
                <Selo valor={r.status}>{rotulo(r.status)}</Selo>
                {r.arquivado ? <Selo>Arquivada</Selo> : null}
              </div>
            </div>
            <div className="tv-account-summary-actions">
              {podeEscrever() && !r.arquivado ? (
                <>
                  <Link className="tv-button tv-button-primary" to={`/agenda?novo=1&contaId=${id}`}>
                    <Icone nome="agenda" />
                    Agendar visita
                  </Link>
                  <Link
                    className="tv-button tv-button-light"
                    to={`/oportunidades?novo=1&contaId=${id}`}
                  >
                    <Icone nome="mais" />
                    Nova oportunidade
                  </Link>
                  <Link className="tv-button tv-button-light" to={`/precos?contaId=${id}`}>
                    Preços por cliente
                  </Link>
                </>
              ) : null}
            </div>
          </div>
          <div className="tv-account-layout">
            <div className="tv-account-main">
              <ContatosConta
                conta={r}
                aoAtualizar={() => {
                  conta.atualizar();
                  trilha.atualizar();
                }}
              />
              <section className="tv-panel">
                <div className="tv-panel-heading">
                  <div>
                    <h2>Próximo passo</h2>
                    <p>Mantenha o relacionamento em movimento.</p>
                  </div>
                  <Icone nome="seta" />
                </div>
                <div className="tv-next-step">
                  <span className="tv-icon-tile">
                    <Icone nome="agenda" />
                  </span>
                  <div>
                    <strong>{r.proximaAcao || 'Defina a próxima ação com esta conta.'}</strong>
                    <p>Próxima visita: {dataFormatada(r.proximaVisita, true)}</p>
                    <small>Frequência planejada: a cada {r.frequenciaVisitaDias ?? 30} dias</small>
                  </div>
                </div>
              </section>
              <section className="tv-panel">
                <div className="tv-panel-heading">
                  <div>
                    <h2>Histórico de atividades</h2>
                    <p>Preparação, conversa e continuidade.</p>
                  </div>
                  <Link className="tv-text-link" to={`/agenda?contaId=${id}`}>
                    Ver agenda
                    <Icone nome="seta" tamanho={16} />
                  </Link>
                </div>
                {atividades.erro ? (
                  <p className="tv-inline-error" role="alert">
                    {atividades.erro}
                  </p>
                ) : atividades.carregando ? (
                  <p className="tv-loading">Carregando atividades…</p>
                ) : atividades.dados?.registros.length ? (
                  <div className="tv-account-timeline">
                    {[...atividades.dados.registros]
                      .sort((a, b) =>
                        (b.data ?? b.alteradoEm).localeCompare(a.data ?? a.alteradoEm),
                      )
                      .map((a) => (
                        <Link
                          className="tv-timeline-item"
                          key={a._id}
                          to={`/agenda?editar=${a._id}`}
                        >
                          <span className="tv-timeline-dot" />
                          <div>
                            <small>
                              {dataFormatada(a.data ?? a.alteradoEm, true)} · {rotulo(a.tipo)}
                            </small>
                            <strong>{nomeRegistro(a)}</strong>
                            {a.resultado ? <p>{a.resultado}</p> : null}
                            {a.proximaAcao ? <p>Próxima ação: {a.proximaAcao}</p> : null}
                            <Selo valor={a.status}>{rotulo(a.status)}</Selo>
                          </div>
                        </Link>
                      ))}
                  </div>
                ) : (
                  <Vazio
                    titulo="A primeira conversa fica na história."
                    texto="Agende ou registre uma visita para acompanhar a evolução deste relacionamento."
                  />
                )}
                {(atividades.dados?.total ?? 0) > 100 ? (
                  <Link className="tv-text-link" to={`/agenda?contaId=${id}`}>
                    Ver todo o histórico na agenda
                  </Link>
                ) : null}
              </section>
              <section className="tv-panel">
                <div className="tv-panel-heading">
                  <div>
                    <h2>Oportunidades da conta</h2>
                    <p>Conexões que podem se transformar em parceria.</p>
                  </div>
                  <Link className="tv-text-link" to={`/oportunidades?contaId=${id}`}>
                    Ver funil
                    <Icone nome="seta" tamanho={16} />
                  </Link>
                </div>
                {oportunidades.erro ? (
                  <p className="tv-inline-error" role="alert">
                    {oportunidades.erro}
                  </p>
                ) : oportunidades.dados?.registros.length ? (
                  <div className="tv-related-deals">
                    {oportunidades.dados.registros.map((o) => (
                      <Link key={o._id} to={`/oportunidades?editar=${o._id}`}>
                        <span className="tv-icon-tile">
                          <Icone nome="funil" />
                        </span>
                        <div>
                          <strong>{nomeRegistro(o)}</strong>
                          <small>{rotulo(o.etapa)}</small>
                        </div>
                        <b>{moeda(o.valorCentavos)}</b>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <Vazio
                    titulo="Encontre espaço para crescer."
                    texto="Registre as necessidades e oportunidades identificadas nesta conta."
                  />
                )}
              </section>
            </div>
            <div className="tv-account-aside">
              <section className="tv-panel">
                <div className="tv-panel-heading">
                  <h2>Sobre a conta</h2>
                  <Icone nome="contas" />
                </div>
                <dl className="tv-detail-list">
                  <div>
                    <dt>Segmento</dt>
                    <dd>{rotulo(r.segmento)}</dd>
                  </div>
                  <div>
                    <dt>Especialidade</dt>
                    <dd>{r.especialidade || 'Não informada'}</dd>
                  </div>
                  <div>
                    <dt>Território</dt>
                    <dd>{r.territorio || 'Não informado'}</dd>
                  </div>
                  <div>
                    <dt>Endereço</dt>
                    <dd>
                      {[r.endereco, r.cidade, r.uf].filter(Boolean).join(' · ') || 'Não informado'}
                    </dd>
                  </div>
                  <div>
                    <dt>Interlocutor</dt>
                    <dd>{r.contatoNome || 'Não informado'}</dd>
                  </div>
                  {r.contatoEmail ? (
                    <div>
                      <dt>E-mail</dt>
                      <dd>
                        <a href={`mailto:${r.contatoEmail}`}>{r.contatoEmail}</a>
                      </dd>
                    </div>
                  ) : null}
                  {r.contatoTelefone ? (
                    <div>
                      <dt>Telefone</dt>
                      <dd>
                        <a href={`tel:${r.contatoTelefone.replace(/[^+\d]/g, '')}`}>
                          {r.contatoTelefone}
                        </a>
                      </dd>
                    </div>
                  ) : null}
                  {r.observacoes ? (
                    <div>
                      <dt>Observações comerciais</dt>
                      <dd>{r.observacoes}</dd>
                    </div>
                  ) : null}
                </dl>
              </section>
              <section className="tv-panel">
                <div className="tv-panel-heading">
                  <h2>Histórico do cadastro</h2>
                  <Icone nome="relogio" />
                </div>
                <div className="tv-audit-list">
                  {trilha.erro ? (
                    <p role="alert">{trilha.erro}</p>
                  ) : (
                    trilha.dados?.eventos
                      .slice(-8)
                      .reverse()
                      .map((e) => (
                        <article key={e.versao}>
                          <strong>
                            {rotulo(e.acao)} <span>· versão {e.versao}</span>
                          </strong>
                          <small>{dataFormatada(e.em, true)}</small>
                          <p>
                            {e.campos.length} campos registrados · responsável identificado no
                            servidor
                          </p>
                        </article>
                      ))
                  )}
                </div>
              </section>
            </div>
          </div>
        </>
      ) : null}
      {editando && r ? (
        <EditorRegistro
          secao="contas"
          registro={r}
          aoFechar={() => setEditando(false)}
          aoSalvar={() => {
            setEditando(false);
            setMensagem('Conta atualizada no servidor.');
            conta.atualizar();
            trilha.atualizar();
          }}
        />
      ) : null}
    </div>
  );
}
