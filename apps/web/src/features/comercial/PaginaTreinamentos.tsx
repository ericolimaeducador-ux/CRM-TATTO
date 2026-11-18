import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  apiComercial,
  dataFormatada,
  nomeRegistro,
  podeEscrever,
  rotulo,
  useComercial,
} from './api';
import { AvisoDados, CabecalhoPagina, Icone, Selo, Vazio } from './componentes';
import { Modal } from './EditorRegistro';
import { EditorTreinamento } from './EditorTreinamento';
import type { ListaTreinamentos, Treinamento } from './treinamentos-api';

export function PaginaTreinamentos() {
  const [params, setParams] = useSearchParams();
  const navegar = useNavigate();
  const [editor, setEditor] = useState<Treinamento | 'novo' | null>(null);
  const [arquivar, setArquivar] = useState<Treinamento | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const pagina = Math.max(1, Number(params.get('pagina')) || 1);
  const status = params.get('status') ?? '';
  const q = params.get('q') ?? '';
  const arquivados = params.get('arquivados') === 'true';
  const query = new URLSearchParams({
    pagina: String(pagina),
    limite: '30',
    ...(q ? { q } : {}),
    ...(status ? { status } : {}),
    ...(arquivados ? { arquivados: 'true' } : {}),
  });
  const lista = useComercial<ListaTreinamentos>(`/treinamentos?${query}`);
  const escrita = podeEscrever();
  const filtro = (chave: string, valor: string) => {
    const p = new URLSearchParams(params);
    p.delete('pagina');
    if (valor) p.set(chave, valor);
    else p.delete(chave);
    setParams(p, { replace: true });
  };
  async function confirmarArquivo() {
    if (!arquivar) return;
    setOcupado(true);
    setErro('');
    try {
      await apiComercial(`/treinamentos/${arquivar._id}`, 'PATCH', {
        versao: arquivar.versao,
        arquivado: !arquivar.arquivado,
      });
      setArquivar(null);
      lista.atualizar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'A alteração não foi confirmada.');
    } finally {
      setOcupado(false);
    }
  }
  return (
    <div className="tv-page">
      <CabecalhoPagina
        titulo="Treinamentos"
        descricao="Organize encontros, inscrições e a participação de cada pessoa."
        acao={
          escrita ? (
            <button className="tv-button tv-button-primary" onClick={() => setEditor('novo')}>
              <Icone nome="mais" />
              Novo treinamento
            </button>
          ) : undefined
        }
      />
      <AvisoDados erro={lista.erro} carregando={lista.carregando} atualizar={lista.atualizar} />
      <section className="tv-panel">
        <div className="tv-list-toolbar">
          <div className="tv-list-tabs">
            <button
              className={!arquivados ? 'active' : ''}
              onClick={() => filtro('arquivados', '')}
            >
              Ativos
            </button>
            <button
              className={arquivados ? 'active' : ''}
              onClick={() => filtro('arquivados', 'true')}
            >
              Arquivados
            </button>
          </div>
          <div className="tv-list-filters">
            <label className="tv-search-field">
              <Icone nome="busca" tamanho={18} />
              <input
                aria-label="Buscar treinamento por título"
                placeholder="Buscar treinamento por título…"
                value={q}
                onChange={(e) => filtro('q', e.target.value)}
              />
            </label>
            <select
              aria-label="Situação dos treinamentos"
              value={status}
              onChange={(e) => filtro('status', e.target.value)}
            >
              <option value="">Todas as situações</option>
              {['planejado', 'em_andamento', 'concluido', 'cancelado'].map((s) => (
                <option key={s} value={s}>
                  {rotulo(s)}
                </option>
              ))}
            </select>
          </div>
        </div>
        {lista.dados && !lista.dados.registros.length ? (
          <Vazio
            titulo={
              arquivados
                ? 'Nenhum treinamento arquivado.'
                : 'Compartilhe conhecimento e fortaleça conexões.'
            }
            texto={
              arquivados
                ? 'Treinamentos arquivados ficam disponíveis para consulta e restauração.'
                : 'Cadastre um encontro, gere o QR de inscrição e acompanhe as pessoas participantes.'
            }
          />
        ) : null}
        <div className="tv-training-grid">
          {lista.dados?.registros.map((t) => (
            <article className="tv-training-card" key={t._id}>
              <div className="tv-training-card-top">
                <span className="tv-icon-tile">
                  <Icone nome="agenda" />
                </span>
                <Selo valor={t.status}>{rotulo(t.status)}</Selo>
              </div>
              <Link to={`/treinamentos/${t._id}`}>
                <h2>{nomeRegistro(t)}</h2>
              </Link>
              <p>{t.motivoTreinamento || t.descricao || 'Objetivo ainda não informado.'}</p>
              <dl>
                <div>
                  <dt>Formato</dt>
                  <dd>{rotulo(t.tipo)}</dd>
                </div>
                <div>
                  <dt>Início</dt>
                  <dd>{dataFormatada(t.dataInicio, true)}</dd>
                </div>
                {t.dataFim ? (
                  <div>
                    <dt>Fim</dt>
                    <dd>{dataFormatada(t.dataFim, true)}</dd>
                  </div>
                ) : null}
                {t.marca ? (
                  <div>
                    <dt>Marca</dt>
                    <dd>{t.marca}</dd>
                  </div>
                ) : null}
                {t.grupoGenerico ? (
                  <div>
                    <dt>Público</dt>
                    <dd>{t.grupoGenerico}</dd>
                  </div>
                ) : null}
              </dl>
              <div className="tv-training-card-actions">
                <Link className="tv-button tv-button-light" to={`/treinamentos/${t._id}`}>
                  Abrir treinamento
                  <Icone nome="seta" tamanho={17} />
                </Link>
                {escrita ? (
                  <>
                    <button className="tv-small-button" onClick={() => setEditor(t)}>
                      Editar
                    </button>
                    <button
                      className="tv-small-button"
                      onClick={() => {
                        setErro('');
                        setArquivar(t);
                      }}
                    >
                      {t.arquivado ? 'Restaurar' : 'Arquivar'}
                    </button>
                  </>
                ) : null}
              </div>
            </article>
          ))}
        </div>
        {lista.dados ? (
          <div className="tv-pagination">
            <span>
              {lista.dados.total} treinamentos · Página {pagina}
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
                disabled={pagina * 30 >= lista.dados.total}
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
        <EditorTreinamento
          registro={editor === 'novo' ? undefined : editor}
          aoFechar={() => setEditor(null)}
          aoSalvar={(t) => {
            setEditor(null);
            navegar(`/treinamentos/${t._id}`);
          }}
        />
      ) : null}
      {arquivar ? (
        <Modal
          titulo={arquivar.arquivado ? 'Restaurar treinamento' : 'Arquivar treinamento'}
          aoFechar={() => setArquivar(null)}
          bloqueado={ocupado}
        >
          <div className="tv-modal-body">
            <h3>{nomeRegistro(arquivar)}</h3>
            <p>
              {arquivar.arquivado
                ? 'O treinamento voltará à lista ativa. Os estados e a validade do QR continuam os registrados no evento.'
                : 'O treinamento sairá da lista ativa e o QR deixará de aceitar inscrições enquanto o evento estiver arquivado. Os cadastros já registrados serão preservados.'}
            </p>
            {erro ? (
              <p className="tv-inline-error" role="alert">
                {erro}
              </p>
            ) : null}
          </div>
          <div className="tv-modal-footer">
            <button
              className="tv-button tv-button-light"
              disabled={ocupado}
              onClick={() => setArquivar(null)}
            >
              Cancelar
            </button>
            <button
              className="tv-button tv-button-primary"
              disabled={ocupado}
              onClick={() => void confirmarArquivo()}
            >
              {ocupado
                ? 'Confirmando…'
                : arquivar.arquivado
                  ? 'Restaurar treinamento'
                  : 'Arquivar treinamento'}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
