import { useState, type FormEvent } from 'react';
import { perfilLogado } from '@/lib/offline/sessao';
import { apiComercial, ErroComercial, podeEscrever, rotulo, useComercial } from './api';
import { AvisoDados, Icone, Selo, Vazio } from './componentes';
import { Modal } from './EditorRegistro';
import { ExportarParticipantes } from './ExportarParticipantes';
import type { ListaParticipantes, Participante, Treinamento } from './treinamentos-api';

export function ParticipantesTreinamento({ treinamento }: { treinamento: Treinamento }) {
  const [pagina, setPagina] = useState(1);
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState('');
  const [editor, setEditor] = useState<Participante | 'novo' | null>(null);
  const [acao, setAcao] = useState<{
    participante: Participante;
    estado: 'confirmado' | 'presente' | 'ausente';
  } | null>(null);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [exportando, setExportando] = useState(false);
  const query = new URLSearchParams({
    treinamentoId: treinamento._id,
    pagina: String(pagina),
    limite: '30',
    ...(busca ? { q: busca } : {}),
    ...(status ? { status } : {}),
  });
  const lista = useComercial<ListaParticipantes>(`/participantes?${query}`);
  const gestao = ['admin', 'gestor'].includes(perfilLogado()?.papel ?? '');
  const escrita = podeEscrever() && !treinamento.arquivado;
  async function confirmarEstado() {
    if (!acao) return;
    setOcupado(true);
    setErro('');
    const p = acao.participante;
    const alteracoes =
      acao.estado === 'presente'
        ? { status: 'presente', presente: true, confirmado: true }
        : acao.estado === 'ausente'
          ? { status: 'ausente', presente: false }
          : { confirmado: true, status: p.presente ? 'presente' : 'confirmado' };
    try {
      await apiComercial(`/participantes/${p._id}`, 'PATCH', { versao: p.versao, ...alteracoes });
      setAcao(null);
      setMensagem('Participação atualizada no servidor.');
      lista.atualizar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'A participação não foi alterada.');
    } finally {
      setOcupado(false);
    }
  }
  return (
    <section className="tv-panel">
      <div className="tv-panel-heading">
        <div>
          <h2>Participantes</h2>
          <p>
            {lista.dados?.total ?? '—'} inscrições nesta seleção. Confirmação e presença ficam com a
            gestão.
          </p>
        </div>
        <div className="tv-participant-header-actions">
          {gestao && !treinamento.arquivado ? (
            <button className="tv-button tv-button-light" onClick={() => setExportando(true)}>
              Exportar participantes
            </button>
          ) : null}
          {escrita ? (
            <button className="tv-button tv-button-light" onClick={() => setEditor('novo')}>
              <Icone nome="mais" />
              Cadastrar participante
            </button>
          ) : null}
        </div>
      </div>
      <div className="tv-list-toolbar">
        <div className="tv-list-filters">
          <label className="tv-search-field">
            <Icone nome="busca" tamanho={18} />
            <input
              aria-label="Buscar participante por nome"
              placeholder="Buscar participante por nome…"
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setPagina(1);
              }}
            />
          </label>
          <select
            aria-label="Situação dos participantes"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPagina(1);
            }}
          >
            <option value="">Todas as situações</option>
            {['inscrito', 'confirmado', 'presente', 'ausente', 'cancelado'].map((s) => (
              <option key={s} value={s}>
                {rotulo(s)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <AvisoDados erro={lista.erro} carregando={lista.carregando} atualizar={lista.atualizar} />
      {mensagem ? (
        <p className="tv-success" role="status">
          {mensagem}
        </p>
      ) : null}
      {lista.dados && !lista.dados.registros.length ? (
        <Vazio
          titulo="Os próximos encontros começam com uma inscrição."
          texto="Cadastre participantes ou compartilhe o QR do treinamento para receber inscrições."
        />
      ) : null}
      {lista.dados?.registros.length ? (
        <div className="tv-table-scroll">
          <table className="tv-table">
            <thead>
              <tr>
                <th>Participante</th>
                <th>Contato</th>
                <th>Situação</th>
                <th>Confirmação / presença</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.dados.registros.map((p) => (
                <tr key={p._id}>
                  <td>
                    <strong>{p.nome || 'Participante sem nome'}</strong>
                    {p.cargo ? <small className="tv-cell-subtext">{p.cargo}</small> : null}
                    {p.origem ? (
                      <small className="tv-cell-subtext">Origem: {p.origem}</small>
                    ) : null}
                  </td>
                  <td>
                    {p.email || 'E-mail não informado'}
                    {p.telefone ? <small className="tv-cell-subtext">{p.telefone}</small> : null}
                  </td>
                  <td>
                    <Selo valor={p.status}>{rotulo(p.status)}</Selo>
                  </td>
                  <td>
                    <span>Inscrição: {p.confirmado ? 'confirmada' : 'pendente'}</span>
                    <small className="tv-cell-subtext">
                      Presença:{' '}
                      {p.presente
                        ? 'registrada'
                        : p.status === 'ausente'
                          ? 'ausente'
                          : 'não registrada'}
                    </small>
                  </td>
                  <td>
                    <div className="tv-participant-actions">
                      {escrita ? (
                        <button className="tv-small-button" onClick={() => setEditor(p)}>
                          Editar cadastro
                        </button>
                      ) : null}
                      {gestao && escrita && p.status !== 'cancelado' ? (
                        <>
                          {!p.confirmado ? (
                            <button
                              className="tv-small-button"
                              onClick={() => {
                                setErro('');
                                setAcao({ participante: p, estado: 'confirmado' });
                              }}
                            >
                              Confirmar inscrição
                            </button>
                          ) : null}
                          {!p.presente ? (
                            <button
                              className="tv-small-button"
                              onClick={() => {
                                setErro('');
                                setAcao({ participante: p, estado: 'presente' });
                              }}
                            >
                              Marcar presente
                            </button>
                          ) : null}
                          {p.status !== 'ausente' ? (
                            <button
                              className="tv-small-button"
                              onClick={() => {
                                setErro('');
                                setAcao({ participante: p, estado: 'ausente' });
                              }}
                            >
                              Marcar ausente
                            </button>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {lista.dados ? (
        <div className="tv-pagination">
          <span>
            {lista.dados.total} participantes · Página {pagina}
          </span>
          <div>
            <button
              className="tv-small-button"
              disabled={pagina <= 1}
              onClick={() => setPagina(pagina - 1)}
            >
              Anterior
            </button>
            <button
              className="tv-small-button"
              disabled={pagina * 30 >= lista.dados.total}
              onClick={() => setPagina(pagina + 1)}
            >
              Próxima
            </button>
          </div>
        </div>
      ) : null}
      {exportando ? (
        <ExportarParticipantes
          treinamento={treinamento}
          aoFechar={() => setExportando(false)}
          aoConcluir={(formato) => {
            setExportando(false);
            setMensagem(
              `Arquivo ${formato.toUpperCase()} recebido do servidor. O download foi solicitado ao navegador.`,
            );
          }}
        />
      ) : null}
      {editor ? (
        <EditorParticipante
          treinamento={treinamento}
          participante={editor === 'novo' ? undefined : editor}
          aoFechar={() => setEditor(null)}
          aoSalvar={() => {
            setEditor(null);
            setMensagem('Cadastro do participante confirmado no servidor.');
            lista.atualizar();
          }}
        />
      ) : null}
      {acao ? (
        <Modal
          titulo={
            acao.estado === 'confirmado'
              ? 'Confirmar inscrição'
              : acao.estado === 'presente'
                ? 'Registrar presença'
                : 'Registrar ausência'
          }
          aoFechar={() => setAcao(null)}
          bloqueado={ocupado}
        >
          <div className="tv-modal-body">
            <h3>{acao.participante.nome || 'Participante sem nome'}</h3>
            <p>{treinamento.titulo || 'Treinamento'}</p>
            <p className="tv-form-intro">
              {acao.estado === 'presente'
                ? 'A inscrição será confirmada e a presença desta pessoa ficará registrada no treinamento.'
                : acao.estado === 'ausente'
                  ? 'A ausência desta pessoa ficará registrada no treinamento e a presença será desmarcada.'
                  : 'A inscrição desta pessoa será confirmada. Esta ação não registra presença.'}
            </p>
            {erro ? (
              <div className="tv-inline-error" role="alert">
                {erro}
                <p>
                  Se o cadastro mudou em outra sessão, feche esta confirmação e atualize a lista
                  antes de tentar novamente.
                </p>
              </div>
            ) : null}
          </div>
          <div className="tv-modal-footer">
            <button
              className="tv-button tv-button-light"
              disabled={ocupado}
              onClick={() => setAcao(null)}
            >
              Cancelar
            </button>
            <button
              className="tv-button tv-button-primary"
              disabled={ocupado}
              onClick={() => void confirmarEstado()}
            >
              {ocupado ? 'Confirmando…' : 'Confirmar alteração'}
            </button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
function EditorParticipante({
  treinamento,
  participante,
  aoFechar,
  aoSalvar,
}: {
  treinamento: Treinamento;
  participante?: Participante;
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const [nome, setNome] = useState(participante?.nome ?? '');
  const [cargo, setCargo] = useState(participante?.cargo ?? '');
  const [email, setEmail] = useState(participante?.email ?? '');
  const [telefone, setTelefone] = useState(participante?.telefone ?? '');
  const [origem, setOrigem] = useState(participante?.origem ?? 'Cadastro manual');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [conflito, setConflito] = useState(false);
  async function salvar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro('');
    try {
      await apiComercial(
        `/participantes${participante ? `/${participante._id}` : ''}`,
        participante ? 'PATCH' : 'POST',
        {
          treinamentoId: treinamento._id,
          nome,
          cargo,
          email,
          telefone,
          origem,
          ...(participante ? { versao: participante.versao } : {}),
        },
      );
      aoSalvar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'O cadastro não foi confirmado.');
      setConflito(e instanceof ErroComercial && e.status === 409);
    } finally {
      setSalvando(false);
    }
  }
  return (
    <Modal
      titulo={participante ? 'Editar participante' : 'Cadastrar participante'}
      aoFechar={aoFechar}
      bloqueado={salvando}
    >
      <form onSubmit={(e) => void salvar(e)}>
        <div className="tv-modal-body">
          <p className="tv-form-intro">
            {treinamento.titulo || 'Treinamento'} · A confirmação da inscrição e a presença são
            registradas separadamente pela gestão.
          </p>
          <div className="tv-form-grid">
            <label className="tv-field tv-field-wide">
              <span>Nome do participante</span>
              <input
                required
                maxLength={500}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </label>
            <label className="tv-field">
              <span>Cargo do participante</span>
              <input maxLength={500} value={cargo} onChange={(e) => setCargo(e.target.value)} />
            </label>
            <label className="tv-field">
              <span>E-mail do participante</span>
              <input
                type="email"
                maxLength={500}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="tv-field">
              <span>Telefone do participante</span>
              <input
                type="tel"
                maxLength={500}
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
              />
            </label>
            <label className="tv-field">
              <span>Origem da inscrição</span>
              <input maxLength={500} value={origem} onChange={(e) => setOrigem(e.target.value)} />
            </label>
          </div>
          {erro ? (
            <div className="tv-inline-error" role="alert">
              <p>{erro}</p>
              {conflito ? (
                <p>
                  Seus campos foram preservados. Reabra o cadastro para comparar com a versão atual.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="tv-modal-footer">
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
            {salvando ? 'Confirmando…' : 'Salvar participante'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
