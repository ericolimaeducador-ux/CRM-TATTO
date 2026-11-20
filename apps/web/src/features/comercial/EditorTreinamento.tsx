import { useEffect, useState, type FormEvent } from 'react';
import {
  apiComercial,
  ErroComercial,
  nomeRegistro,
  rotulo,
  todasReferencias,
  type Registro,
} from './api';
import { Modal } from './EditorRegistro';
import { linkSeguro, type Treinamento } from './treinamentos-api';

type CamposTreinamento = {
  titulo: string;
  tipo: string;
  dataInicio: string;
  dataFim: string;
  linkAcesso: string;
  grupoGenerico: string;
  marca: string;
  status: string;
  motivoTreinamento: string;
  descricao: string;
  contaId: string;
  oportunidadeId: string;
};
function localData(valor?: string) {
  if (!valor || !Number.isFinite(Date.parse(valor))) return '';
  const d = new Date(valor);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
export function EditorTreinamento({
  registro,
  aoFechar,
  aoSalvar,
}: {
  registro?: Treinamento;
  aoFechar: () => void;
  aoSalvar: (r: Treinamento) => void;
}) {
  const [campos, setCampos] = useState<CamposTreinamento>({
    titulo: registro?.titulo ?? '',
    tipo: registro?.tipo ?? 'presencial',
    dataInicio: localData(registro?.dataInicio),
    dataFim: localData(registro?.dataFim),
    linkAcesso: registro?.linkAcesso ?? '',
    grupoGenerico: registro?.grupoGenerico ?? '',
    marca: registro?.marca ?? '',
    status: registro?.status ?? 'planejado',
    motivoTreinamento: registro?.motivoTreinamento ?? '',
    descricao: registro?.descricao ?? '',
    contaId: registro?.contaId ?? '',
    oportunidadeId: registro?.oportunidadeId ?? '',
  });
  const [contas, setContas] = useState<Registro[]>([]);
  const [oportunidades, setOportunidades] = useState<Registro[]>([]);
  const [erroRefs, setErroRefs] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [conflito, setConflito] = useState(false);
  const [confirmarFechamento, setConfirmarFechamento] = useState(false);
  const encerraInscricao =
    ['concluido', 'cancelado'].includes(campos.status) && campos.status !== registro?.status;
  useEffect(() => {
    let vivo = true;
    void Promise.all([todasReferencias('contas'), todasReferencias('oportunidades')])
      .then(([c, o]) => {
        if (vivo) {
          setContas(c);
          setOportunidades(o);
        }
      })
      .catch((e: unknown) => {
        if (vivo)
          setErroRefs(e instanceof Error ? e.message : 'Não consegui carregar os vínculos.');
      });
    return () => {
      vivo = false;
    };
  }, []);
  const mudar = (campo: keyof CamposTreinamento, valor: string) => {
    setCampos((antes) => ({
      ...antes,
      [campo]: valor,
      ...(campo === 'contaId' ? { oportunidadeId: '' } : {}),
    }));
    if (campo === 'status') setConfirmarFechamento(false);
  };
  async function salvar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro('');
    try {
      if (campos.linkAcesso && !linkSeguro(campos.linkAcesso))
        throw new Error('Informe um link de acesso que comece com https:// ou http://.');
      if (campos.dataFim && Date.parse(campos.dataFim) < Date.parse(campos.dataInicio))
        throw new Error('O horário final precisa ser posterior ao início do treinamento.');
      if (encerraInscricao && !confirmarFechamento)
        throw new Error('Confirme o encerramento das inscrições deste treinamento.');
      const resposta = await apiComercial<{ registro: Treinamento }>(
        `/treinamentos${registro ? `/${registro._id}` : ''}`,
        registro ? 'PATCH' : 'POST',
        {
          ...campos,
          dataInicio: new Date(campos.dataInicio).toISOString(),
          dataFim: campos.dataFim ? new Date(campos.dataFim).toISOString() : null,
          ...(registro ? { versao: registro.versao } : {}),
        },
      );
      aoSalvar(resposta.registro);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'O treinamento não foi confirmado.');
      setConflito(e instanceof ErroComercial && e.status === 409);
    } finally {
      setSalvando(false);
    }
  }
  return (
    <Modal
      titulo={registro ? 'Editar treinamento' : 'Novo treinamento'}
      aoFechar={aoFechar}
      bloqueado={salvando}
      largo
    >
      <form onSubmit={(e) => void salvar(e)}>
        <div className="tv-modal-body">
          <p className="tv-form-intro">
            Organize o encontro, seu público e o objetivo. A geração do QR de inscrição fica
            disponível depois de salvar.
          </p>
          {erroRefs ? (
            <p className="tv-inline-error" role="alert">
              {erroRefs}
            </p>
          ) : null}
          <div className="tv-form-grid">
            <label className="tv-field tv-field-wide">
              <span>Título do treinamento</span>
              <input
                maxLength={500}
                value={campos.titulo}
                onChange={(e) => mudar('titulo', e.target.value)}
              />
            </label>
            <label className="tv-field">
              <span>Formato do treinamento</span>
              <select value={campos.tipo} onChange={(e) => mudar('tipo', e.target.value)}>
                <option value="presencial">Presencial</option>
                <option value="online">Online</option>
              </select>
            </label>
            <label className="tv-field">
              <span>Situação do treinamento</span>
              <select value={campos.status} onChange={(e) => mudar('status', e.target.value)}>
                {['planejado', 'em_andamento', 'concluido', 'cancelado'].map((s) => (
                  <option key={s} value={s}>
                    {rotulo(s)}
                  </option>
                ))}
              </select>
            </label>
            <label className="tv-field">
              <span>Início do treinamento</span>
              <input
                type="datetime-local"
                required
                value={campos.dataInicio}
                onChange={(e) => mudar('dataInicio', e.target.value)}
              />
            </label>
            <label className="tv-field">
              <span>Fim do treinamento</span>
              <input
                type="datetime-local"
                value={campos.dataFim}
                onChange={(e) => mudar('dataFim', e.target.value)}
              />
            </label>
            <label className="tv-field tv-field-wide">
              <span>Link de acesso (opcional)</span>
              <input
                type="url"
                maxLength={500}
                value={campos.linkAcesso}
                onChange={(e) => mudar('linkAcesso', e.target.value)}
                placeholder="https://"
              />
            </label>
            <label className="tv-field">
              <span>Grupo / público do treinamento</span>
              <input
                maxLength={500}
                value={campos.grupoGenerico}
                onChange={(e) => mudar('grupoGenerico', e.target.value)}
              />
            </label>
            <label className="tv-field">
              <span>Marca relacionada</span>
              <input
                maxLength={500}
                value={campos.marca}
                onChange={(e) => mudar('marca', e.target.value)}
              />
            </label>
            <label className="tv-field">
              <span>Conta relacionada</span>
              <select value={campos.contaId} onChange={(e) => mudar('contaId', e.target.value)}>
                <option value="">Sem vínculo com conta</option>
                {campos.contaId && !contas.some((c) => c._id === campos.contaId) ? (
                  <option value={campos.contaId}>Conta vinculada</option>
                ) : null}
                {contas.map((c) => (
                  <option value={c._id} key={c._id}>
                    {nomeRegistro(c)}
                  </option>
                ))}
              </select>
            </label>
            <label className="tv-field">
              <span>Oportunidade relacionada</span>
              <select
                value={campos.oportunidadeId}
                onChange={(e) => mudar('oportunidadeId', e.target.value)}
              >
                <option value="">Sem vínculo com oportunidade</option>
                {campos.oportunidadeId &&
                !oportunidades.some((o) => o._id === campos.oportunidadeId) ? (
                  <option value={campos.oportunidadeId}>Oportunidade vinculada</option>
                ) : null}
                {oportunidades
                  .filter((o) => !campos.contaId || o.contaId === campos.contaId)
                  .map((o) => (
                    <option value={o._id} key={o._id}>
                      {nomeRegistro(o)}
                    </option>
                  ))}
              </select>
            </label>
            <label className="tv-field tv-field-wide">
              <span>Objetivo / motivo do treinamento</span>
              <textarea
                rows={3}
                maxLength={500}
                value={campos.motivoTreinamento}
                onChange={(e) => mudar('motivoTreinamento', e.target.value)}
              />
            </label>
            <label className="tv-field tv-field-wide">
              <span>Descrição para os participantes</span>
              <textarea
                rows={4}
                maxLength={500}
                value={campos.descricao}
                onChange={(e) => mudar('descricao', e.target.value)}
              />
            </label>
          </div>
          {encerraInscricao ? (
            <label className="tv-training-confirm">
              <input
                type="checkbox"
                checked={confirmarFechamento}
                onChange={(e) => setConfirmarFechamento(e.target.checked)}
              />
              Ao salvar como {rotulo(campos.status).toLowerCase()}, as inscrições por QR deste
              treinamento serão encerradas.
            </label>
          ) : null}
          {erro ? (
            <div className="tv-inline-error" role="alert">
              <p>{erro}</p>
              {conflito ? (
                <p>
                  A edição continua neste formulário. Reabra o treinamento para conferir a versão
                  atual antes de salvar novamente.
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
            {salvando ? 'Confirmando…' : 'Salvar treinamento'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
