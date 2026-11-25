import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  apiCampanhas,
  ErroCampanha,
  motivoCampanha,
  type PendenciasCampanha,
} from './campanhas-api';

const ORIGENS: Record<string, string> = {
  manual: 'Digitado',
  qr_proprio: 'Autocadastro QR',
  qr_lido: 'QR lido',
  google_forms: 'Google Forms',
  importado: 'Importação',
  importacao: 'Importação',
};

export const COMO_RESOLVER: Record<string, string> = {
  sem_autorizacao_documentada:
    'Pergunte à pessoa se ela aceita receber contato comercial. Só depois que ela disser sim, abra a ficha e registre o aceite.',
  sem_telefone_valido:
    'Abra a ficha e corrija o telefone com DDD + número (ex.: 11 91234-5678). Confira se é WhatsApp.',
  destinatario_solicitou_parada:
    'A pessoa pediu para não receber mensagens. Não reinclua; respeite o pedido.',
};

export function PendenciasDeCampanha() {
  const [motivo, setMotivo] = useState('');
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState<PendenciasCampanha | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    setErro('');
    const params = new URLSearchParams({ pagina: String(pagina) });
    if (motivo) params.set('motivo', motivo);
    apiCampanhas<PendenciasCampanha>(`/pendencias?${params.toString()}`)
      .then((r) => {
        if (vivo) setDados(r);
      })
      .catch((e: unknown) => {
        if (vivo)
          setErro(e instanceof ErroCampanha ? e.message : 'Não consegui carregar as pendências.');
      })
      .finally(() => {
        if (vivo) setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, [motivo, pagina]);

  const motivos = Object.entries(dados?.contagem ?? {});
  const totalFora = motivos.reduce((s, [, n]) => s + n, 0);

  return (
    <section className="tv-panel tv-campaign-section" aria-labelledby="titulo-pendencias-campanha">
      <h2 id="titulo-pendencias-campanha">Contatos que ficam de fora das campanhas</h2>
      <p>
        Estes contatos não entram em nenhuma campanha até serem ajustados. Abra a ficha, corrija e
        eles passam a aparecer como elegíveis na seleção.
      </p>
      {dados ? (
        <p>
          <strong>{dados.elegiveis}</strong> elegíveis · <strong>{totalFora}</strong> precisam de
          ajuste
          {dados.truncado ? ` (conferidos os ${dados.analisados} mais recentes)` : ''}
        </p>
      ) : null}
      {motivos.length ? (
        <div className="tv-campaign-actions" role="group" aria-label="Filtrar por motivo">
          <button
            type="button"
            className={`tv-small-button ${motivo === '' ? 'is-active' : ''}`}
            aria-pressed={motivo === ''}
            onClick={() => {
              setMotivo('');
              setPagina(1);
            }}
          >
            Todos ({totalFora})
          </button>
          {motivos.map(([m, n]) => (
            <button
              key={m}
              type="button"
              className={`tv-small-button ${motivo === m ? 'is-active' : ''}`}
              aria-pressed={motivo === m}
              onClick={() => {
                setMotivo(m);
                setPagina(1);
              }}
            >
              {motivoCampanha(m)} ({n})
            </button>
          ))}
        </div>
      ) : null}
      {motivo && COMO_RESOLVER[motivo] ? (
        <p className="tv-campaign-hint">{COMO_RESOLVER[motivo]}</p>
      ) : null}
      {carregando ? <p role="status">Conferindo contatos…</p> : null}
      {erro ? (
        <p role="alert" className="tv-inline-error">
          {erro}
        </p>
      ) : null}
      {dados && !carregando && dados.total === 0 && !erro ? (
        <p>Nenhum contato precisa de ajuste. Todos os ativos estão elegíveis.</p>
      ) : null}
      <ul className="tv-campaign-candidates">
        {dados?.registros.map((r) => (
          <li key={r.id} className="tv-campaign-candidate is-excluded">
            <span>
              <strong>{r.nome}</strong>
              <span>
                {r.telefoneRegistrado} · {ORIGENS[r.origem] ?? (r.origem || 'Origem não informada')}
                {r.criadoEm
                  ? ` · entrou em ${new Date(r.criadoEm).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`
                  : ''}
              </span>
              <small>{motivoCampanha(r.motivo)}</small>
              {!motivo && COMO_RESOLVER[r.motivo] ? <small>{COMO_RESOLVER[r.motivo]}</small> : null}
              {r.motivo !== 'destinatario_solicitou_parada' ? (
                <Link className="tv-small-button" to={`/lead/${r.id}`}>
                  Abrir ficha para ajustar
                </Link>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      {dados && dados.total > dados.limite ? (
        <nav className="tv-pagination tv-campaign-pagination" aria-label="Páginas de pendências">
          <span>
            {dados.total} contatos · Página {dados.pagina}
          </span>
          <div>
            <button
              type="button"
              className="tv-small-button"
              disabled={pagina <= 1}
              onClick={() => setPagina(pagina - 1)}
            >
              Anterior
            </button>
            <button
              type="button"
              className="tv-small-button"
              disabled={pagina * dados.limite >= dados.total}
              onClick={() => setPagina(pagina + 1)}
            >
              Próxima
            </button>
          </div>
        </nav>
      ) : null}
    </section>
  );
}
