import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { Icone, Selo } from './componentes';
import { dataFormatada, rotulo } from './api';
import { linkSeguro, publicoTreinamento, type TreinamentoPublico } from './treinamentos-api';

export function InscricaoTreinamento() {
  const { token = '' } = useParams();
  const [treinamento, setTreinamento] = useState<TreinamentoPublico | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [revisao, setRevisao] = useState(0);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [cargo, setCargo] = useState('');
  const [telefone, setTelefone] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [concluido, setConcluido] = useState(false);
  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    setErro('');
    setTreinamento(null);
    void publicoTreinamento<{ treinamento: TreinamentoPublico }>(token)
      .then((r) => {
        if (vivo) setTreinamento(r.treinamento);
      })
      .catch((e: unknown) => {
        if (vivo)
          setErro(e instanceof Error ? e.message : 'Não foi possível abrir esta inscrição.');
      })
      .finally(() => {
        if (vivo) setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, [token, revisao]);
  async function inscrever(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro('');
    try {
      await publicoTreinamento(token, { nome, email, cargo, telefone });
      setConcluido(true);
    } catch (e) {
      setErro(
        e instanceof Error
          ? e.message
          : 'Sua inscrição não foi confirmada. Os campos continuam preenchidos.',
      );
    } finally {
      setSalvando(false);
    }
  }
  return (
    <section className="tv-training-public">
      <span className="tv-eyebrow">INSCRIÇÃO EM TREINAMENTO</span>
      {carregando ? (
        <div className="tv-loading" role="status">
          <span className="tv-spinner" />
          Consultando o treinamento…
        </div>
      ) : null}
      {treinamento ? (
        <>
          <div className="tv-training-public-heading">
            <h1>{treinamento.titulo || 'Treinamento Tela Viva'}</h1>
            <Selo valor={treinamento.tipo}>{rotulo(treinamento.tipo)}</Selo>
          </div>
          <dl className="tv-detail-grid">
            <div>
              <dt>Início</dt>
              <dd>{dataFormatada(treinamento.dataInicio, true)}</dd>
            </div>
            {treinamento.dataFim ? (
              <div>
                <dt>Fim</dt>
                <dd>{dataFormatada(treinamento.dataFim, true)}</dd>
              </div>
            ) : null}
            {treinamento.marca ? (
              <div>
                <dt>Marca</dt>
                <dd>{treinamento.marca}</dd>
              </div>
            ) : null}
          </dl>
          {treinamento.descricao ? (
            <p className="tv-training-description">{treinamento.descricao}</p>
          ) : null}
          {concluido ? (
            <div className="tv-training-registration-done" role="status">
              <span className="tv-icon-tile">
                <Icone nome="check" />
              </span>
              <h2>Inscrição registrada.</h2>
              <p>
                Seu cadastro foi registrado para este treinamento. A confirmação e a presença são
                acompanhadas pela organização.
              </p>
              {linkSeguro(treinamento.linkAcesso) ? (
                <a
                  className="tv-button tv-button-light"
                  href={linkSeguro(treinamento.linkAcesso) ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Abrir link do treinamento
                </a>
              ) : null}
            </div>
          ) : (
            <form onSubmit={(e) => void inscrever(e)}>
              <p className="tv-form-intro">
                Informe nome e e-mail para registrar sua inscrição. Cargo e telefone são opcionais.
              </p>
              <div className="tv-form-grid">
                <label className="tv-field tv-field-wide">
                  <span>Nome para inscrição</span>
                  <input
                    required
                    maxLength={500}
                    autoComplete="name"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                  />
                </label>
                <label className="tv-field tv-field-wide">
                  <span>E-mail para inscrição</span>
                  <input
                    required
                    type="email"
                    maxLength={500}
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <label className="tv-field">
                  <span>Cargo (opcional)</span>
                  <input maxLength={500} value={cargo} onChange={(e) => setCargo(e.target.value)} />
                </label>
                <label className="tv-field">
                  <span>Telefone (opcional)</span>
                  <input
                    type="tel"
                    maxLength={500}
                    autoComplete="tel"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                  />
                </label>
              </div>
              <aside className="tv-training-privacy">
                <strong>Finalidade desta inscrição</strong>
                <p>
                  A JSETTE7 Comércio de Produtos Médicos e Hospitalares LTDA, CNPJ
                  54.765.439/0001-34, usará os dados informados para registrar a inscrição e
                  acompanhar a participação neste treinamento. Este formulário não concede
                  autorização de contato comercial. Para falar sobre seus dados:{' '}
                  <a href="mailto:settedistribuidora0777@gmail.com">
                    settedistribuidora0777@gmail.com
                  </a>
                  .
                </p>
              </aside>
              <button className="tv-button tv-button-primary" type="submit" disabled={salvando}>
                {salvando ? 'Confirmando inscrição…' : 'Registrar minha inscrição'}
              </button>
            </form>
          )}
        </>
      ) : null}
      {erro ? (
        <div className="tv-inline-error" role="alert">
          <p>{erro}</p>
          {!treinamento ? (
            <button className="tv-button tv-button-light" onClick={() => setRevisao((n) => n + 1)}>
              Consultar treinamento novamente
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
