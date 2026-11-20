import { useState, type FormEvent } from 'react';
import { urlDaApi } from '@/lib/api-url';
import { cabecalhosDaSessao, perfilLogado } from '@/lib/offline/sessao';
import { Modal } from './EditorRegistro';
import type { Treinamento } from './treinamentos-api';

type Formato = 'csv' | 'xlsx';
async function erroDaResposta(resposta: Response, etapa: 'codigo' | 'arquivo') {
  let codigo = '';
  let mensagem = '';
  try {
    const json = (await resposta.json()) as {
      erros?: { codigo?: string; mensagem?: string }[];
      message?: string;
    };
    codigo = json.erros?.[0]?.codigo ?? '';
    mensagem = json.erros?.[0]?.mensagem ?? (typeof json.message === 'string' ? json.message : '');
  } catch {
    /* A mensagem abaixo cobre resposta sem JSON. */
  }
  if (resposta.status === 413 || codigo === 'EXPORTACAO_LIMITE')
    return 'Este treinamento ultrapassa o limite de 2.000 participantes por exportação. Nenhum arquivo foi baixado. A lista completa não pode ser exportada por esta rota enquanto estiver acima desse limite.';
  if (codigo === 'CODIGO_TOTP_REUSADO')
    return (
      mensagem ||
      'Este código do autenticador já foi utilizado. Aguarde o próximo código e tente novamente.'
    );
  if (codigo === 'LOGIN_BLOQUEADO' || resposta.status === 429)
    return mensagem || 'Foram feitas muitas tentativas. Aguarde antes de informar outro código.';
  if (resposta.status === 401 || codigo === 'SESSAO_AUSENTE')
    return 'Sua sessão expirou. Entre novamente como gestor ou administrador antes de exportar.';
  if (etapa === 'codigo')
    return (
      mensagem ||
      'O código não foi aceito. Confira os 6 dígitos atuais do autenticador e tente novamente.'
    );
  if (resposta.status === 403)
    return (
      mensagem ||
      'A exportação exige perfil de gestor ou administrador e uma confirmação TOTP válida. Revise sua sessão e tente com um código atual.'
    );
  return (
    mensagem || 'O servidor não entregou o arquivo. Nenhum download foi iniciado. Tente novamente.'
  );
}
function nomeArquivo(cabecalho: string | null, formato: Formato) {
  let nome = '';
  const estendido = cabecalho?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (estendido) {
    try {
      nome = decodeURIComponent(estendido.trim());
    } catch {
      /* Usa filename simples ou fallback abaixo. */
    }
  }
  if (!nome)
    nome =
      cabecalho?.match(/filename="([^"]+)"/i)?.[1] ??
      cabecalho?.match(/filename=([^;]+)/i)?.[1]?.trim() ??
      '';
  nome = Array.from(nome, (caractere) =>
    caractere.charCodeAt(0) < 32 || caractere.charCodeAt(0) === 127 ? '_' : caractere,
  )
    .join('')
    .replace(/[\\/:*?"<>|]/g, '_')
    .trim()
    .slice(0, 180);
  if (!nome || nome === '.' || nome === '..') return `tela-viva-participantes.${formato}`;
  if (!nome.toLowerCase().endsWith(`.${formato}`)) nome += `.${formato}`;
  return nome;
}
export function ExportarParticipantes({
  treinamento,
  aoFechar,
  aoConcluir,
}: {
  treinamento: Treinamento;
  aoFechar: () => void;
  aoConcluir: (formato: Formato) => void;
}) {
  const [formato, setFormato] = useState<Formato>('csv');
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [etapa, setEtapa] = useState('');
  async function exportar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    if (!['admin', 'gestor'].includes(perfilLogado()?.papel ?? '')) {
      setErro('Entre como gestor ou administrador para exportar participantes.');
      return;
    }
    if (!/^\d{6}$/.test(codigo.trim())) {
      setErro('Informe os 6 dígitos atuais do aplicativo autenticador antes de exportar.');
      return;
    }
    setOcupado(true);
    setEtapa('Confirmando o código do autenticador…');
    try {
      const passo = await fetch(urlDaApi('/v1/auth/step-up'), {
        method: 'POST',
        headers: cabecalhosDaSessao(),
        body: JSON.stringify({ codigoTotp: codigo.trim() }),
      });
      if (!passo.ok) throw new Error(await erroDaResposta(passo, 'codigo'));
      setCodigo('');
      setEtapa('Solicitando o arquivo protegido ao servidor…');
      const resposta = await fetch(
        urlDaApi(
          `/v1/comercial/treinamentos/${encodeURIComponent(treinamento._id)}/participantes/exportar?formato=${formato}`,
        ),
        { headers: cabecalhosDaSessao() },
      );
      if (!resposta.ok) throw new Error(await erroDaResposta(resposta, 'arquivo'));
      if (resposta.headers.get('content-type')?.includes('application/json'))
        throw new Error(
          'A API não entregou um arquivo de participantes. Nenhum download foi iniciado.',
        );
      const arquivo = await resposta.blob();
      if (!arquivo.size)
        throw new Error('O servidor retornou um arquivo vazio. Nenhum download foi iniciado.');
      const url = URL.createObjectURL(arquivo);
      const ancora = document.createElement('a');
      ancora.href = url;
      ancora.download = nomeArquivo(resposta.headers.get('content-disposition'), formato);
      document.body.appendChild(ancora);
      try {
        ancora.click();
      } finally {
        ancora.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      aoConcluir(formato);
    } catch (e) {
      setErro(
        e instanceof TypeError
          ? 'Não foi possível receber o arquivo. Confira sua conexão e tente novamente com um código atual do autenticador.'
          : e instanceof Error
            ? e.message
            : 'Não foi possível confirmar a exportação. Verifique sua conexão e tente novamente.',
      );
    } finally {
      setCodigo('');
      setOcupado(false);
      setEtapa('');
    }
  }
  return (
    <Modal titulo="Exportar participantes" aoFechar={aoFechar} bloqueado={ocupado}>
      <form onSubmit={(e) => void exportar(e)}>
        <div className="tv-modal-body">
          <h3>{treinamento.titulo || 'Treinamento'}</h3>
          <p className="tv-form-intro">
            O arquivo incluirá todos os participantes ativos deste treinamento, com nome, cargo,
            e-mail, telefone, situação, confirmação, presença e data de inscrição. Os filtros e a
            página que você está consultando não limitam a exportação. O limite é de 2.000
            participantes por arquivo.
          </p>
          <p className="tv-help-text">
            A solicitação será registrada na auditoria do servidor com seu usuário e o formato
            escolhido. A exportação pede confirmação no aplicativo autenticador.
          </p>
          <div className="tv-form-grid tv-export-fields">
            <label className="tv-field">
              <span>Formato da exportação</span>
              <select
                value={formato}
                disabled={ocupado}
                onChange={(e) => setFormato(e.target.value as Formato)}
              >
                <option value="csv">CSV</option>
                <option value="xlsx">Excel (XLSX)</option>
              </select>
            </label>
            <label className="tv-field">
              <span>Código do autenticador</span>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={codigo}
                disabled={ocupado}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
                placeholder="6 dígitos"
              />
            </label>
          </div>
          {ocupado ? (
            <p className="tv-loading" role="status">
              {etapa}
            </p>
          ) : null}
          {erro ? (
            <div className="tv-inline-error" role="alert">
              <p>{erro}</p>
              <p>
                Se um código já foi confirmado nesta tentativa, aguarde o próximo código antes de
                tentar novamente.
              </p>
            </div>
          ) : null}
        </div>
        <div className="tv-modal-footer">
          <button
            className="tv-button tv-button-light"
            type="button"
            disabled={ocupado}
            onClick={aoFechar}
          >
            Cancelar
          </button>
          <button className="tv-button tv-button-primary" type="submit" disabled={ocupado}>
            {ocupado ? 'Preparando exportação…' : `Confirmar e baixar ${formato.toUpperCase()}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}
