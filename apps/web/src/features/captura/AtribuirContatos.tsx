import { useState } from 'react';
import { urlDaApi } from '@/lib/api-url';
import { textoDaResposta } from '@/lib/texto-resposta';
import { cabecalhosDaSessao } from '@/lib/offline/sessao';
import type { UsuarioComercial } from '../comercial/api';

const LIMITE = 500;

export function AtribuirContatos({
  ids,
  equipe,
  aoLimpar,
  aoConcluir,
}: {
  ids: string[];
  equipe: UsuarioComercial[];
  aoLimpar: () => void;
  aoConcluir: (mensagem: string) => void;
}) {
  const [responsavel, setResponsavel] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const pessoas = equipe.filter((p) => ['vendedor', 'gestor', 'admin'].includes(p.papel ?? ''));

  async function atribuir() {
    setEnviando(true);
    setErro('');
    try {
      const resposta = await fetch(urlDaApi('/v1/contatos/atribuir'), {
        method: 'POST',
        headers: cabecalhosDaSessao(),
        body: JSON.stringify({ ids: ids.slice(0, LIMITE), responsavelId: responsavel }),
      });
      const json = (await resposta.json().catch(() => ({}))) as {
        dados?: { atribuidos?: number; semMudanca?: number; naoEncontrados?: number };
        erros?: { mensagem?: string }[];
        mensagem?: string;
      };
      if (!resposta.ok) {
        setErro(textoDaResposta(json, 'A atribuição não foi feita. Nada foi alterado.'));
        return;
      }
      const nome =
        responsavel === 'sem'
          ? 'ninguém (sem responsável)'
          : (pessoas.find((p) => p.id === responsavel)?.nome ?? 'a pessoa escolhida');
      const d = json.dados ?? {};
      const partes = [`${d.atribuidos ?? 0} contato(s) agora com ${nome}`];
      if (d.semMudanca) partes.push(`${d.semMudanca} já estavam com essa pessoa`);
      if (d.naoEncontrados) partes.push(`${d.naoEncontrados} não puderam ser alterados`);
      aoConcluir(`${partes.join(' · ')}.`);
    } catch {
      setErro('Sem resposta do servidor. Nada foi alterado. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      className="cartao sticky top-2 z-10 flex flex-col gap-3 bg-white"
      role="region"
      aria-label="Atribuir contatos selecionados"
    >
      <p className="text-base font-semibold">
        {ids.length} contato(s) selecionado(s)
        {ids.length > LIMITE ? ` — serão atribuídos os primeiros ${LIMITE}` : ''}
      </p>
      <label className="flex flex-col gap-1 text-base">
        Passar para
        <select
          className="campo"
          value={responsavel}
          onChange={(evento) => setResponsavel(evento.target.value)}
        >
          <option value="">Escolha quem vai cuidar</option>
          {pessoas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
          <option value="sem">Tirar o responsável</option>
        </select>
      </label>
      {erro ? <p role="alert">{erro}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="tv-button"
          disabled={!responsavel || enviando}
          onClick={() => void atribuir()}
        >
          {enviando ? 'Atribuindo…' : 'Atribuir'}
        </button>
        <button type="button" className="tv-button tv-button-light" onClick={aoLimpar}>
          Limpar seleção
        </button>
      </div>
    </div>
  );
}
