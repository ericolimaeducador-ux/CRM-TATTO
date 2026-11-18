import { useState, type FormEvent } from 'react';
import { apiComercial, ErroComercial, podeEscrever, type PessoaConta, type Registro } from './api';
import { Icone, Selo, Vazio } from './componentes';
import { Modal } from './EditorRegistro';

const novaPessoa = (): PessoaConta => ({
  id: crypto.randomUUID(),
  nome: '',
  cargo: '',
  email: '',
  telefone: '',
  principal: false,
  ativo: true,
  observacoes: '',
});
export function ContatosConta({
  conta,
  aoAtualizar,
}: {
  conta: Registro;
  aoAtualizar: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [pessoas, setPessoas] = useState<PessoaConta[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [conflito, setConflito] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const cadastradas = conta.pessoas ?? [];
  const legado = Boolean(conta.contatoNome || conta.contatoEmail || conta.contatoTelefone);
  const legadoNaLista = cadastradas.some(
    (p) =>
      p.principal &&
      p.ativo &&
      p.nome === (conta.contatoNome ?? '') &&
      p.email === (conta.contatoEmail ?? '') &&
      p.telefone === (conta.contatoTelefone ?? ''),
  );
  const abrir = () => {
    setPessoas(cadastradas.map((p) => ({ ...p })));
    setErro('');
    setConflito(false);
    setEditando(true);
  };
  const mudar = (id: string, patch: Partial<PessoaConta>) =>
    setPessoas((atuais) =>
      atuais.map((p) =>
        p.id === id
          ? { ...p, ...patch, ...(patch.ativo === false ? { principal: false } : {}) }
          : p,
      ),
    );
  async function salvar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro('');
    const principal = pessoas.find((p) => p.principal && p.ativo);
    try {
      await apiComercial(`/contas/${conta._id}`, 'PATCH', {
        versao: conta.versao,
        pessoas,
        ...(principal
          ? {
              contatoNome: principal.nome,
              contatoEmail: principal.email,
              contatoTelefone: principal.telefone,
            }
          : {}),
      });
      setMensagem('Contatos confirmados na conta.');
      setEditando(false);
      aoAtualizar();
    } catch (e) {
      setErro(
        e instanceof Error
          ? e.message
          : 'Não consegui confirmar os contatos. A edição foi preservada.',
      );
      setConflito(e instanceof ErroComercial && e.status === 409);
    } finally {
      setSalvando(false);
    }
  }
  return (
    <section className="tv-panel">
      <div className="tv-panel-heading">
        <div>
          <h2>Pessoas e contatos</h2>
          <p>{cadastradas.filter((p) => p.ativo).length} contatos ativos na conta.</p>
        </div>
        {podeEscrever() && !conta.arquivado ? (
          <button className="tv-button tv-button-light" onClick={abrir}>
            <Icone nome="contatos" />
            Gerenciar contatos
          </button>
        ) : null}
      </div>
      {mensagem ? (
        <p className="tv-success" role="status">
          {mensagem}
        </p>
      ) : null}
      {legado && !legadoNaLista ? (
        <article className="tv-person-card tv-legacy-contact">
          <div className="tv-person-heading">
            <strong>{conta.contatoNome || 'Contato principal do cadastro'}</strong>
            <Selo>Principal do cadastro</Selo>
          </div>
          {conta.contatoEmail ? (
            <a href={`mailto:${conta.contatoEmail}`}>{conta.contatoEmail}</a>
          ) : null}
          {conta.contatoTelefone ? (
            <a href={`tel:${conta.contatoTelefone.replace(/[^+\d]/g, '')}`}>
              {conta.contatoTelefone}
            </a>
          ) : null}
          <p>Este contato continua disponível enquanto você organiza a lista da conta.</p>
        </article>
      ) : null}
      {cadastradas.length ? (
        <div className="tv-person-list">
          {cadastradas.map((p) => (
            <article className={`tv-person-card ${p.ativo ? '' : 'tv-person-inactive'}`} key={p.id}>
              <div className="tv-person-heading">
                <div>
                  <strong>{p.nome || 'Contato sem nome'}</strong>
                  {p.cargo ? <span>{p.cargo}</span> : null}
                </div>
                <div className="tv-person-badges">
                  <Selo valor={p.ativo ? 'ativo' : 'inativo'}>{p.ativo ? 'Ativo' : 'Inativo'}</Selo>
                  {p.principal && p.ativo ? <Selo valor="A">Contato padrão</Selo> : null}
                </div>
              </div>
              {p.email ? <a href={`mailto:${p.email}`}>{p.email}</a> : null}
              {p.telefone ? (
                <a href={`tel:${p.telefone.replace(/[^+\d]/g, '')}`}>{p.telefone}</a>
              ) : null}
              {p.observacoes ? <p>{p.observacoes}</p> : null}
            </article>
          ))}
        </div>
      ) : !legado ? (
        <Vazio
          titulo="Conheça as pessoas por trás da conta."
          texto="Adicione interlocutores, cargos e canais de contato. Escolha o contato padrão para facilitar a preparação das propostas."
        />
      ) : null}
      {editando ? (
        <Modal
          titulo="Contatos da conta"
          aoFechar={() => setEditando(false)}
          bloqueado={salvando}
          largo
        >
          <form onSubmit={(e) => void salvar(e)}>
            <div className="tv-modal-body">
              <p className="tv-form-intro">
                Mantenha os contatos e o papel de cada pessoa neste relacionamento. O contato padrão
                ativo também atualiza o contato principal do cadastro.
              </p>
              <div className="tv-contact-editor-actions">
                <button
                  className="tv-button tv-button-light"
                  type="button"
                  disabled={pessoas.length >= 100}
                  onClick={() => setPessoas([...pessoas, novaPessoa()])}
                >
                  <Icone nome="mais" />
                  Adicionar contato
                </button>
                {legado &&
                !pessoas.some(
                  (p) => p.nome === conta.contatoNome && p.email === (conta.contatoEmail ?? ''),
                ) ? (
                  <button
                    className="tv-button tv-button-light"
                    type="button"
                    disabled={pessoas.length >= 100}
                    onClick={() =>
                      setPessoas([
                        ...pessoas,
                        {
                          ...novaPessoa(),
                          nome: conta.contatoNome ?? '',
                          email: conta.contatoEmail ?? '',
                          telefone: conta.contatoTelefone ?? '',
                          principal: !pessoas.some((p) => p.principal && p.ativo),
                        },
                      ])
                    }
                  >
                    Trazer contato principal para a lista
                  </button>
                ) : null}
              </div>
              {pessoas.map((p, indice) => (
                <fieldset className="tv-contact-editor" key={p.id}>
                  <legend>Contato {indice + 1}</legend>
                  <div className="tv-form-grid">
                    <label className="tv-field">
                      <span>Nome do contato {indice + 1}</span>
                      <input
                        maxLength={160}
                        value={p.nome}
                        onChange={(e) => mudar(p.id, { nome: e.target.value })}
                      />
                    </label>
                    <label className="tv-field">
                      <span>Cargo do contato {indice + 1}</span>
                      <input
                        maxLength={120}
                        value={p.cargo}
                        onChange={(e) => mudar(p.id, { cargo: e.target.value })}
                      />
                    </label>
                    <label className="tv-field">
                      <span>E-mail do contato {indice + 1}</span>
                      <input
                        type="email"
                        maxLength={254}
                        value={p.email}
                        onChange={(e) => mudar(p.id, { email: e.target.value })}
                      />
                    </label>
                    <label className="tv-field">
                      <span>Telefone do contato {indice + 1}</span>
                      <input
                        type="tel"
                        maxLength={40}
                        value={p.telefone}
                        onChange={(e) => mudar(p.id, { telefone: e.target.value })}
                      />
                    </label>
                    <label className="tv-field tv-field-wide">
                      <span>Observações do contato {indice + 1}</span>
                      <textarea
                        rows={2}
                        maxLength={1000}
                        value={p.observacoes}
                        onChange={(e) => mudar(p.id, { observacoes: e.target.value })}
                      />
                    </label>
                  </div>
                  <div className="tv-contact-options">
                    <label>
                      <input
                        type="checkbox"
                        checked={p.ativo}
                        onChange={(e) => mudar(p.id, { ativo: e.target.checked })}
                      />
                      Contato ativo
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="contato-padrao"
                        checked={p.principal && p.ativo}
                        disabled={!p.ativo}
                        onChange={() =>
                          setPessoas(
                            pessoas.map((atual) => ({ ...atual, principal: atual.id === p.id })),
                          )
                        }
                      />
                      Contato padrão
                    </label>
                    {!cadastradas.some((c) => c.id === p.id) ? (
                      <button
                        className="tv-small-button"
                        type="button"
                        onClick={() => setPessoas(pessoas.filter((atual) => atual.id !== p.id))}
                      >
                        Remover da edição
                      </button>
                    ) : null}
                  </div>
                  {!p.ativo ? (
                    <p className="tv-help-text">
                      Inativo: não poderá ser escolhido em novas propostas. Reative-o para definir
                      como contato padrão.
                    </p>
                  ) : null}
                </fieldset>
              ))}
              {erro ? (
                <div className="tv-inline-error" role="alert">
                  <p>{erro}</p>
                  {conflito ? (
                    <p>
                      A conta mudou em outra sessão. Seus campos continuam nesta edição; anote as
                      alterações e reabra os contatos para comparar com a versão atual.
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
                onClick={() => setEditando(false)}
              >
                Cancelar
              </button>
              <button
                className="tv-button tv-button-primary"
                type="submit"
                disabled={salvando || conflito}
              >
                {salvando ? 'Confirmando…' : 'Salvar contatos na conta'}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </section>
  );
}
