import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { perfilLogado } from '@/lib/offline/sessao';
import {
  apiComercial,
  dataFormatada,
  ErroComercial,
  moeda,
  nomeRegistro,
  podeEscrever,
  rotulo,
  temSessao,
  todasReferencias,
  useComercial,
  type Evento,
  type Registro,
} from './api';
import { AvisoDados, CabecalhoPagina, Icone, Selo, Vazio } from './componentes';
import { Modal } from './EditorRegistro';

export interface PrecoCliente {
  _id: string;
  versao: number;
  contaId: string;
  produtoId: string;
  precoCentavos: number;
  precoReferenciaCentavos?: number;
  status: string;
  validade?: string;
  motivo?: string;
  motivoDecisao?: string;
  decisaoEm?: string;
  motivoFechamento?: string;
  encerradoEm?: string;
  criadoEm: string;
  alteradoEm: string;
}
interface ListaPrecos {
  registros: PrecoCliente[];
  total: number;
  pagina: number;
  limite: number;
}
type Acao = 'aprovar' | 'reprovar' | 'ganho' | 'perdido';
const ESTADOS = ['solicitado', 'aguardando_aprovacao', 'aprovado', 'reprovado', 'ganho', 'perdido'];
export function PaginaPrecosCliente() {
  const [params, setParams] = useSearchParams();
  const [contas, setContas] = useState<Registro[]>([]);
  const [produtos, setProdutos] = useState<Registro[]>([]);
  const [erroRefs, setErroRefs] = useState('');
  const [editor, setEditor] = useState<PrecoCliente | 'novo' | null>(null);
  const [decisao, setDecisao] = useState<{ preco: PrecoCliente; acao: Acao } | null>(null);
  const [historico, setHistorico] = useState<PrecoCliente | null>(null);
  const [mensagem, setMensagem] = useState('');
  const pagina = Math.max(1, Number(params.get('pagina')) || 1);
  const status = params.get('status') ?? '';
  const contaId = params.get('contaId') ?? '';
  const produtoId = params.get('produtoId') ?? '';
  const query = new URLSearchParams({
    limite: '30',
    pagina: String(pagina),
    ...(status ? { status } : {}),
    ...(contaId ? { contaId } : {}),
    ...(produtoId ? { produtoId } : {}),
  });
  const lista = useComercial<ListaPrecos>(`/precosCliente?${query}`);
  const gestao = ['admin', 'gestor'].includes(perfilLogado()?.papel ?? '');
  const escrita = podeEscrever();
  useEffect(() => {
    let vivo = true;
    if (!temSessao()) return;
    void Promise.all([todasReferencias('contas'), todasReferencias('produtos')])
      .then(([c, p]) => {
        if (vivo) {
          setContas(c);
          setProdutos(p);
        }
      })
      .catch((e: unknown) => {
        if (vivo)
          setErroRefs(e instanceof Error ? e.message : 'Não consegui carregar contas e produtos.');
      });
    return () => {
      vivo = false;
    };
  }, []);
  const filtro = (chave: string, valor: string) => {
    const p = new URLSearchParams(params);
    if (valor) p.set(chave, valor);
    else p.delete(chave);
    p.delete('pagina');
    setParams(p, { replace: true });
  };
  const contaNome = (id: string) => contas.find((c) => c._id === id)?.nome || 'Conta vinculada';
  const produtoNome = (id: string) =>
    produtos.find((p) => p._id === id)?.nome || 'Produto vinculado';
  const pronto = temSessao() && !lista.carregando && !lista.erro && lista.dados;
  return (
    <div className="tv-page">
      <CabecalhoPagina
        titulo="Preços por cliente"
        descricao="Negocie condições por conta e produto, com aprovação e histórico em cada etapa."
        acao={
          escrita ? (
            <button className="tv-button tv-button-primary" onClick={() => setEditor('novo')}>
              <Icone nome="mais" />
              Solicitar preço
            </button>
          ) : undefined
        }
      />
      <AvisoDados erro={lista.erro} carregando={lista.carregando} atualizar={lista.atualizar} />
      <div className="tv-price-flow" aria-label="Etapas da negociação">
        <span>Solicitação do representante</span>
        <Icone nome="seta" />
        <span>Decisão da gestão</span>
        <Icone nome="seta" />
        <span>Encerramento: ganho ou perda</span>
      </div>
      {mensagem ? (
        <p className="tv-success" role="status">
          <Icone nome="check" />
          {mensagem}
        </p>
      ) : null}
      {erroRefs ? (
        <p className="tv-inline-error" role="alert">
          {erroRefs}
        </p>
      ) : null}
      <section className="tv-panel">
        <div className="tv-list-toolbar">
          <div className="tv-list-filters tv-price-filters">
            <label className="tv-field">
              <span>Cliente</span>
              <select value={contaId} onChange={(e) => filtro('contaId', e.target.value)}>
                <option value="">Todos os clientes</option>
                {contaId && !contas.some((c) => c._id === contaId) ? (
                  <option value={contaId}>Cliente selecionado</option>
                ) : null}
                {contas.map((c) => (
                  <option value={c._id} key={c._id}>
                    {nomeRegistro(c)}
                  </option>
                ))}
              </select>
            </label>
            <label className="tv-field">
              <span>Produto</span>
              <select value={produtoId} onChange={(e) => filtro('produtoId', e.target.value)}>
                <option value="">Todos os produtos</option>
                {produtos.map((p) => (
                  <option value={p._id} key={p._id}>
                    {nomeRegistro(p)}
                  </option>
                ))}
              </select>
            </label>
            <label className="tv-field">
              <span>Situação da negociação</span>
              <select value={status} onChange={(e) => filtro('status', e.target.value)}>
                <option value="">Todas as situações</option>
                {ESTADOS.map((s) => (
                  <option value={s} key={s}>
                    {rotulo(s)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        {pronto && !lista.dados?.registros.length ? (
          <Vazio
            titulo="Uma condição comercial começa com uma boa justificativa."
            texto="Solicite um preço para um cliente e produto. A gestão aprova ou reprova, e o representante registra o desfecho."
          />
        ) : null}
        {pronto && lista.dados?.registros.length ? (
          <div className="tv-price-list">
            {lista.dados.registros.map((p) => (
              <article className="tv-price-card" key={p._id}>
                <div className="tv-price-card-header">
                  <div>
                    <Link className="tv-record-name" to={`/carteira/${p.contaId}`}>
                      {contaNome(p.contaId)}
                    </Link>
                    <h2>{produtoNome(p.produtoId)}</h2>
                  </div>
                  <Selo valor={p.status}>{rotulo(p.status)}</Selo>
                </div>
                <div className="tv-price-values">
                  <div>
                    <span>Preço solicitado</span>
                    <strong>{moeda(p.precoCentavos)}</strong>
                  </div>
                  <div>
                    <span>Referência registrada</span>
                    <b>
                      {p.precoReferenciaCentavos != null
                        ? moeda(p.precoReferenciaCentavos)
                        : 'Não informada'}
                    </b>
                  </div>
                  <div>
                    <span>Validade</span>
                    <b>{dataFormatada(p.validade)}</b>
                  </div>
                </div>
                {p.motivo ? (
                  <p className="tv-price-reason">
                    <strong>Justificativa:</strong> {p.motivo}
                  </p>
                ) : null}
                {p.motivoDecisao ? (
                  <p className="tv-price-reason">
                    <strong>Decisão da gestão:</strong> {p.motivoDecisao}
                  </p>
                ) : null}
                {p.motivoFechamento ? (
                  <p className="tv-price-reason">
                    <strong>Desfecho:</strong> {p.motivoFechamento}
                  </p>
                ) : null}
                <div className="tv-price-card-footer">
                  <small>Solicitado em {dataFormatada(p.criadoEm, true)}</small>
                  <div className="tv-row-actions">
                    <button className="tv-small-button" onClick={() => setHistorico(p)}>
                      Histórico e detalhes
                    </button>
                    {escrita && ['solicitado', 'aguardando_aprovacao'].includes(p.status) ? (
                      <button className="tv-small-button" onClick={() => setEditor(p)}>
                        Editar solicitação
                      </button>
                    ) : null}
                    {gestao && ['solicitado', 'aguardando_aprovacao'].includes(p.status) ? (
                      <>
                        <button
                          className="tv-button tv-button-light"
                          onClick={() => setDecisao({ preco: p, acao: 'reprovar' })}
                        >
                          Reprovar
                        </button>
                        <button
                          className="tv-button tv-button-primary"
                          onClick={() => setDecisao({ preco: p, acao: 'aprovar' })}
                        >
                          Aprovar
                        </button>
                      </>
                    ) : null}
                    {escrita && p.status === 'aprovado' ? (
                      <>
                        <button
                          className="tv-button tv-button-light"
                          onClick={() => setDecisao({ preco: p, acao: 'perdido' })}
                        >
                          Encerrar como perdido
                        </button>
                        <button
                          className="tv-button tv-button-primary"
                          onClick={() => setDecisao({ preco: p, acao: 'ganho' })}
                        >
                          Encerrar como ganho
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}
        {pronto ? (
          <div className="tv-pagination">
            <span>
              {lista.dados?.total} negociações · Página {pagina}
            </span>
            <div>
              <button
                className="tv-small-button"
                disabled={pagina <= 1}
                onClick={() => {
                  const p = new URLSearchParams(params);
                  p.set('pagina', String(pagina - 1));
                  setParams(p);
                }}
              >
                Anterior
              </button>
              <button
                className="tv-small-button"
                disabled={pagina * 30 >= (lista.dados?.total ?? 0)}
                onClick={() => {
                  const p = new URLSearchParams(params);
                  p.set('pagina', String(pagina + 1));
                  setParams(p);
                }}
              >
                Próxima
              </button>
            </div>
          </div>
        ) : null}
      </section>
      {editor ? (
        <EditorPreco
          preco={editor === 'novo' ? undefined : editor}
          contaInicial={contaId}
          contas={contas}
          produtos={produtos}
          aoFechar={() => setEditor(null)}
          aoSalvar={() => {
            setEditor(null);
            setMensagem(
              'Solicitação de preço confirmada no servidor. A decisão fica com a gestão.',
            );
            lista.atualizar();
          }}
        />
      ) : null}
      {decisao ? (
        <DecisaoPreco
          preco={decisao.preco}
          acao={decisao.acao}
          contaNome={contaNome(decisao.preco.contaId)}
          produtoNome={produtoNome(decisao.preco.produtoId)}
          aoFechar={() => setDecisao(null)}
          aoSalvar={() => {
            setDecisao(null);
            setMensagem('Situação da negociação confirmada no servidor.');
            lista.atualizar();
          }}
        />
      ) : null}
      {historico ? (
        <HistoricoPreco
          preco={historico}
          contaNome={contaNome(historico.contaId)}
          produtoNome={produtoNome(historico.produtoId)}
          aoFechar={() => setHistorico(null)}
        />
      ) : null}
    </div>
  );
}
export function EditorPreco({
  preco,
  contaInicial,
  contas,
  produtos,
  aoFechar,
  aoSalvar,
}: {
  preco?: PrecoCliente;
  contaInicial: string;
  contas: Registro[];
  produtos: Registro[];
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const [contaId, setConta] = useState(preco?.contaId ?? contaInicial);
  const [produtoId, setProduto] = useState(preco?.produtoId ?? '');
  const [valor, setValor] = useState(preco ? String(preco.precoCentavos / 100) : '');
  const [referencia, setReferencia] = useState(
    preco?.precoReferenciaCentavos != null ? String(preco.precoReferenciaCentavos / 100) : '',
  );
  const [validade, setValidade] = useState(preco?.validade?.slice(0, 10) ?? '');
  const [motivo, setMotivo] = useState(preco?.motivo ?? '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [conflito, setConflito] = useState(false);
  async function salvar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro('');
    try {
      await apiComercial(
        `/precosCliente${preco ? `/${preco._id}` : ''}`,
        preco ? 'PATCH' : 'POST',
        {
          ...(preco ? { versao: preco.versao } : {}),
          contaId,
          produtoId,
          precoCentavos: Math.round(Number(valor) * 100),
          ...(referencia !== ''
            ? { precoReferenciaCentavos: Math.round(Number(referencia) * 100) }
            : {}),
          validade: validade || null,
          motivo,
        },
      );
      aoSalvar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui confirmar a solicitação.');
      setConflito(e instanceof ErroComercial && e.status === 409);
    } finally {
      setSalvando(false);
    }
  }
  return (
    <Modal
      titulo={preco ? 'Editar solicitação de preço' : 'Solicitar preço por cliente'}
      aoFechar={aoFechar}
      bloqueado={salvando}
    >
      <form onSubmit={(e) => void salvar(e)}>
        <div className="tv-modal-body">
          <p className="tv-form-intro">
            A solicitação ficará aguardando decisão da gestão. O preço só é aprovado por gestor ou
            administrador.
          </p>
          <div className="tv-form-grid">
            <label className="tv-field">
              <span>Cliente da negociação</span>
              <select required value={contaId} onChange={(e) => setConta(e.target.value)}>
                <option value="">Selecione um cliente</option>
                {contaId && !contas.some((c) => c._id === contaId) ? (
                  <option value={contaId}>Cliente vinculado</option>
                ) : null}
                {contas.map((c) => (
                  <option value={c._id} key={c._id}>
                    {nomeRegistro(c)}
                  </option>
                ))}
              </select>
            </label>
            <label className="tv-field">
              <span>Produto negociado</span>
              <select
                required
                value={produtoId}
                onChange={(e) => {
                  setProduto(e.target.value);
                  const produto = produtos.find((p) => p._id === e.target.value);
                  setReferencia(
                    produto?.precoCentavos != null ? String(produto.precoCentavos / 100) : '',
                  );
                }}
              >
                <option value="">Selecione um produto</option>
                {produtoId && !produtos.some((p) => p._id === produtoId) ? (
                  <option value={produtoId}>Produto vinculado</option>
                ) : null}
                {produtos.map((p) => (
                  <option value={p._id} key={p._id}>
                    {nomeRegistro(p)}
                  </option>
                ))}
              </select>
            </label>
            <label className="tv-field">
              <span>Preço solicitado (R$)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
            </label>
            <label className="tv-field">
              <span>Preço de referência (R$)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
              />
            </label>
            <label className="tv-field">
              <span>Validade da condição</span>
              <input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} />
            </label>
            <label className="tv-field tv-field-wide">
              <span>Justificativa da solicitação</span>
              <textarea
                rows={4}
                maxLength={500}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </label>
          </div>
          {erro ? (
            <div className="tv-inline-error" role="alert">
              <p>{erro}</p>
              {conflito ? (
                <p>
                  Seus campos foram preservados. Reabra o pedido para conferir a versão atual antes
                  de tentar novamente.
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
            {salvando ? 'Confirmando…' : preco ? 'Atualizar solicitação' : 'Enviar para aprovação'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function DecisaoPreco({
  preco,
  acao,
  contaNome,
  produtoNome,
  aoFechar,
  aoSalvar,
}: {
  preco: PrecoCliente;
  acao: Acao;
  contaNome: string;
  produtoNome: string;
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [conflito, setConflito] = useState(false);
  const encerramento = acao === 'ganho' || acao === 'perdido';
  const motivoObrigatorio = acao === 'reprovar' || acao === 'perdido';
  const titulo =
    acao === 'aprovar'
      ? 'Aprovar condição comercial'
      : acao === 'reprovar'
        ? 'Reprovar solicitação de preço'
        : `Encerrar negociação como ${acao}`;
  async function confirmar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro('');
    try {
      await apiComercial(
        `/precosCliente/${preco._id}/${encerramento ? 'encerrar' : acao}`,
        'POST',
        { versao: preco.versao, motivo, ...(encerramento ? { resultado: acao } : {}) },
      );
      aoSalvar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'A decisão não foi confirmada.');
      setConflito(e instanceof ErroComercial && e.status === 409);
    } finally {
      setSalvando(false);
    }
  }
  return (
    <Modal titulo={titulo} aoFechar={aoFechar} bloqueado={salvando}>
      <form onSubmit={(e) => void confirmar(e)}>
        <div className="tv-modal-body">
          <dl className="tv-detail-grid">
            <div>
              <dt>Cliente</dt>
              <dd>{contaNome}</dd>
            </div>
            <div>
              <dt>Produto</dt>
              <dd>{produtoNome}</dd>
            </div>
            <div>
              <dt>Preço solicitado</dt>
              <dd>{moeda(preco.precoCentavos)}</dd>
            </div>
            <div>
              <dt>Situação atual</dt>
              <dd>{rotulo(preco.status)}</dd>
            </div>
          </dl>
          <p className="tv-form-intro">
            {encerramento
              ? `O pedido aprovado será encerrado como ${acao}. O resultado e a justificativa ficarão no histórico da negociação.`
              : acao === 'aprovar'
                ? 'A condição comercial será aprovada e ficará disponível para registrar o desfecho da negociação. O preço aprovado não poderá ser editado; mudanças exigem nova solicitação.'
                : 'O pedido será reprovado com o motivo informado. O representante poderá abrir uma nova solicitação.'}
          </p>
          <label className="tv-field">
            <span>
              {motivoObrigatorio ? 'Motivo da decisão' : 'Observação da decisão (opcional)'}
            </span>
            <textarea
              required={motivoObrigatorio}
              maxLength={1000}
              rows={4}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </label>
          {erro ? (
            <div className="tv-inline-error" role="alert">
              <p>{erro}</p>
              {conflito ? (
                <p>
                  Atualize a lista antes de decidir novamente. O texto desta justificativa continua
                  no formulário.
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
            {salvando
              ? 'Confirmando…'
              : acao === 'aprovar'
                ? 'Confirmar aprovação'
                : acao === 'reprovar'
                  ? 'Confirmar reprovação'
                  : `Confirmar ${acao}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function HistoricoPreco({
  preco,
  contaNome,
  produtoNome,
  aoFechar,
}: {
  preco: PrecoCliente;
  contaNome: string;
  produtoNome: string;
  aoFechar: () => void;
}) {
  const historico = useComercial<{ eventos: Evento[] }>(`/precosCliente/${preco._id}/auditoria`);
  return (
    <Modal titulo="Histórico da negociação" aoFechar={aoFechar}>
      <div className="tv-modal-body">
        <h3>{contaNome}</h3>
        <p>{produtoNome}</p>
        <dl className="tv-detail-grid">
          <div>
            <dt>Preço solicitado</dt>
            <dd>{moeda(preco.precoCentavos)}</dd>
          </div>
          <div>
            <dt>Situação</dt>
            <dd>
              <Selo valor={preco.status}>{rotulo(preco.status)}</Selo>
            </dd>
          </div>
          <div>
            <dt>Solicitação</dt>
            <dd>{dataFormatada(preco.criadoEm, true)}</dd>
          </div>
          <div>
            <dt>Validade</dt>
            <dd>{dataFormatada(preco.validade)}</dd>
          </div>
          {preco.decisaoEm ? (
            <div>
              <dt>Decisão da gestão</dt>
              <dd>{dataFormatada(preco.decisaoEm, true)}</dd>
            </div>
          ) : null}
          {preco.encerradoEm ? (
            <div>
              <dt>Encerramento</dt>
              <dd>{dataFormatada(preco.encerradoEm, true)}</dd>
            </div>
          ) : null}
        </dl>
        {preco.motivo ? (
          <p className="tv-price-reason">
            <strong>Justificativa:</strong> {preco.motivo}
          </p>
        ) : null}
        {preco.motivoDecisao ? (
          <p className="tv-price-reason">
            <strong>Motivo da decisão:</strong> {preco.motivoDecisao}
          </p>
        ) : null}
        {preco.motivoFechamento ? (
          <p className="tv-price-reason">
            <strong>Motivo do desfecho:</strong> {preco.motivoFechamento}
          </p>
        ) : null}
        <h3>Alterações registradas</h3>
        <AvisoDados
          erro={historico.erro}
          carregando={historico.carregando}
          atualizar={historico.atualizar}
        />
        <div className="tv-audit-list">
          {historico.dados?.eventos
            .slice()
            .reverse()
            .map((e) => (
              <article key={e.versao}>
                <strong>
                  {rotulo(e.acao)} · versão {e.versao}
                </strong>
                <small>{dataFormatada(e.em, true)}</small>
                <p>Responsável identificado na trilha · {e.campos.length} campos registrados.</p>
              </article>
            ))}
        </div>
      </div>
      <div className="tv-modal-footer">
        <button className="tv-button tv-button-light" onClick={aoFechar}>
          Fechar histórico
        </button>
      </div>
    </Modal>
  );
}
