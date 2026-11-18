import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  apiComercial,
  dataFormatada,
  nomeRegistro,
  podeEscrever,
  rotulo,
  useComercial,
} from './api';
import { AvisoDados, CabecalhoPagina, Icone, Selo } from './componentes';
import { Modal } from './EditorRegistro';
import { EditorTreinamento } from './EditorTreinamento';
import { ParticipantesTreinamento } from './ParticipantesTreinamento';
import { linkSeguro, urlInscricaoTreinamento, type Treinamento } from './treinamentos-api';

type InfoQr = { url: string; imagem: string; expiraEm: string };
export function DetalheTreinamento() {
  const { id = '' } = useParams();
  const dados = useComercial<{ registro: Treinamento }>(`/treinamentos/${id}`);
  const [editor, setEditor] = useState(false);
  const [qrAberto, setQrAberto] = useState(false);
  const [qr, setQr] = useState<InfoQr | null>(null);
  const [mensagem, setMensagem] = useState('');
  const t = dados.dados?.registro;
  const encerrado = t && (t.arquivado || ['cancelado', 'concluido'].includes(t.status ?? ''));
  return (
    <div className="tv-page">
      <Link className="tv-back-link" to="/treinamentos">
        ← Voltar para treinamentos
      </Link>
      <CabecalhoPagina
        titulo={t ? nomeRegistro(t) : 'Treinamento'}
        descricao="Do planejamento à participação, acompanhe os detalhes do encontro."
        acao={
          t && podeEscrever() ? (
            <button className="tv-button tv-button-light" onClick={() => setEditor(true)}>
              Editar treinamento
            </button>
          ) : undefined
        }
      />
      <AvisoDados erro={dados.erro} carregando={dados.carregando} atualizar={dados.atualizar} />
      {mensagem ? (
        <p className="tv-success" role="status">
          {mensagem}
        </p>
      ) : null}
      {t ? (
        <>
          <section className="tv-panel">
            <div className="tv-panel-heading">
              <div>
                <h2>Sobre o encontro</h2>
                <p>{t.marca || 'Marca não informada'}</p>
              </div>
              <div className="tv-training-detail-badges">
                <Selo valor={t.status}>{rotulo(t.status)}</Selo>
                <Selo valor={t.tipo}>{rotulo(t.tipo)}</Selo>
                {t.arquivado ? <Selo>Arquivado</Selo> : null}
              </div>
            </div>
            <div className="tv-training-details">
              <dl className="tv-detail-grid">
                <div>
                  <dt>Início</dt>
                  <dd>{dataFormatada(t.dataInicio, true)}</dd>
                </div>
                <div>
                  <dt>Fim</dt>
                  <dd>{dataFormatada(t.dataFim, true)}</dd>
                </div>
                {t.grupoGenerico ? (
                  <div>
                    <dt>Grupo / público</dt>
                    <dd>{t.grupoGenerico}</dd>
                  </div>
                ) : null}
                {t.contaId ? (
                  <div>
                    <dt>Conta relacionada</dt>
                    <dd>
                      <Link to={`/carteira/${t.contaId}`}>Abrir conta da carteira</Link>
                    </dd>
                  </div>
                ) : null}
                {t.oportunidadeId ? (
                  <div>
                    <dt>Oportunidade relacionada</dt>
                    <dd>
                      <Link to={`/oportunidades?editar=${t.oportunidadeId}`}>
                        Abrir oportunidade
                      </Link>
                    </dd>
                  </div>
                ) : null}
                {linkSeguro(t.linkAcesso) ? (
                  <div>
                    <dt>Link de acesso</dt>
                    <dd>
                      <a
                        href={linkSeguro(t.linkAcesso) ?? undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Abrir link do treinamento
                      </a>
                    </dd>
                  </div>
                ) : null}
              </dl>
              {t.motivoTreinamento ? (
                <div className="tv-training-text">
                  <h3>Objetivo do treinamento</h3>
                  <p>{t.motivoTreinamento}</p>
                </div>
              ) : null}
              {t.descricao ? (
                <div className="tv-training-text">
                  <h3>Descrição para participantes</h3>
                  <p>{t.descricao}</p>
                </div>
              ) : null}
              {podeEscrever() && !encerrado ? (
                <div className="tv-training-qr-callout">
                  <span className="tv-icon-tile">
                    <Icone nome="qr" />
                  </span>
                  <div>
                    <h3>Inscrição simples, por QR.</h3>
                    <p>
                      Gere o endereço público deste encontro para receber inscrições sem exigir
                      sessão.
                    </p>
                  </div>
                  <button className="tv-button tv-button-primary" onClick={() => setQrAberto(true)}>
                    Abrir inscrições por QR
                  </button>
                </div>
              ) : encerrado ? (
                <p className="tv-help-text">
                  As inscrições públicas por QR estão encerradas enquanto este treinamento estiver
                  concluído, cancelado ou arquivado.
                </p>
              ) : null}
            </div>
          </section>
          <ParticipantesTreinamento treinamento={t} />
        </>
      ) : null}
      {editor && t ? (
        <EditorTreinamento
          registro={t}
          aoFechar={() => setEditor(false)}
          aoSalvar={() => {
            setEditor(false);
            setMensagem('Treinamento atualizado no servidor.');
            dados.atualizar();
          }}
        />
      ) : null}
      {qrAberto && t ? (
        <QrTreinamento
          treinamento={t}
          info={qr}
          aoGerar={setQr}
          aoFechar={() => {
            setQrAberto(false);
            dados.atualizar();
          }}
        />
      ) : null}
    </div>
  );
}
function QrTreinamento({
  treinamento,
  info,
  aoGerar,
  aoFechar,
}: {
  treinamento: Treinamento;
  info: InfoQr | null;
  aoGerar: (info: InfoQr) => void;
  aoFechar: () => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  async function gerar() {
    setOcupado(true);
    setErro('');
    setMensagem('');
    try {
      const resposta = await apiComercial<{
        registro: Treinamento;
        tokenInscricao: string;
        expiraEm: string;
      }>(`/treinamentos/${treinamento._id}/qr`, 'POST', {});
      if (!resposta.tokenInscricao)
        throw new Error('O servidor não confirmou o endereço de inscrição.');
      const url = urlInscricaoTreinamento(resposta.tokenInscricao);
      const imagem = await QRCode.toDataURL(url, {
        width: 320,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: { dark: '#16140F', light: '#FBF7F1' },
      });
      aoGerar({ url, imagem, expiraEm: resposta.expiraEm });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui gerar o QR.');
    } finally {
      setOcupado(false);
    }
  }
  async function copiar() {
    if (!info) return;
    try {
      await navigator.clipboard.writeText(info.url);
      setMensagem('Link de inscrição copiado.');
    } catch {
      setMensagem(
        'Não foi possível copiar automaticamente. Selecione o endereço abaixo para compartilhar.',
      );
    }
  }
  return (
    <Modal titulo="QR de inscrição no treinamento" aoFechar={aoFechar} bloqueado={ocupado}>
      <div className="tv-modal-body">
        <h3>{nomeRegistro(treinamento)}</h3>
        <p className="tv-form-intro">
          Gerar um QR substitui o endereço de inscrição anterior deste treinamento. Quem receber o
          link poderá informar nome e e-mail para inscrição. O QR deixa de aceitar inscrições ao
          expirar ou quando o treinamento for encerrado, cancelado ou arquivado.
        </p>
        {info ? (
          <div className="tv-training-qr">
            <img
              src={info.imagem}
              alt={`QR de inscrição: ${nomeRegistro(treinamento)}`}
              width="320"
              height="320"
            />
            <p>Validade do endereço: {dataFormatada(info.expiraEm, true)}</p>
            <label className="tv-field">
              <span>Link público de inscrição</span>
              <input readOnly value={info.url} onFocus={(e) => e.target.select()} />
            </label>
            <div className="tv-quick-actions">
              <button
                type="button"
                className="tv-button tv-button-light"
                onClick={() => void copiar()}
              >
                Copiar link
              </button>
              <a
                className="tv-button tv-button-light"
                href={info.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir inscrição
              </a>
            </div>
          </div>
        ) : null}
        {mensagem ? (
          <p className="tv-help-text" role="status">
            {mensagem}
          </p>
        ) : null}
        {erro ? (
          <p className="tv-inline-error" role="alert">
            {erro}
          </p>
        ) : null}
      </div>
      <div className="tv-modal-footer">
        <button className="tv-button tv-button-light" disabled={ocupado} onClick={aoFechar}>
          Fechar
        </button>
        <button
          className="tv-button tv-button-primary"
          disabled={ocupado}
          onClick={() => void gerar()}
        >
          {ocupado
            ? 'Gerando QR…'
            : info
              ? 'Gerar novo QR e substituir anterior'
              : 'Gerar QR de inscrição'}
        </button>
      </div>
    </Modal>
  );
}
