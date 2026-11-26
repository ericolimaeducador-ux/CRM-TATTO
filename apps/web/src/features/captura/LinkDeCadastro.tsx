import { useState } from 'react';
import { urlDaApi } from '@/lib/api-url';
import { textoDaResposta } from '@/lib/texto-resposta';
import { cabecalhosDaSessao } from '@/lib/offline/sessao';

/**
 * Gera, na ficha, o link pessoal para o titular completar o cadastro (ADR-034).
 * O link vale 7 dias e um envio; os dados entram direto nesta ficha.
 */
export function LinkDeCadastro({
  id,
  nome,
  telefone,
}: {
  id: string;
  nome: string;
  telefone?: string;
}) {
  const [link, setLink] = useState('');
  const [validade, setValidade] = useState('');
  const [gerando, setGerando] = useState(false);
  const [aviso, setAviso] = useState('');

  async function gerar() {
    setGerando(true);
    setAviso('');
    try {
      const resposta = await fetch(urlDaApi(`/v1/contatos/${id}/link-atualizacao`), {
        method: 'POST',
        headers: cabecalhosDaSessao(),
      });
      const json = (await resposta.json().catch(() => null)) as {
        caminho?: string;
        expiraEm?: string;
        mensagem?: string;
      } | null;
      if (!resposta.ok || !json?.caminho)
        throw new Error(textoDaResposta(json ?? {}, 'Não foi possível gerar o link.'));
      const base = import.meta.env.BASE_URL.replace(/\/$/, '');
      const gerado = `${window.location.origin}${base}${json.caminho}`;
      setLink(gerado);
      setValidade(
        json.expiraEm
          ? new Intl.DateTimeFormat('pt-BR', {
              dateStyle: 'short',
              timeStyle: 'short',
              timeZone: 'America/Sao_Paulo',
            }).format(new Date(json.expiraEm))
          : '',
      );
      await navigator.clipboard?.writeText(gerado).catch(() => undefined);
      setAviso('Link copiado. Envie somente para este contato.');
    } catch (causa) {
      setAviso(causa instanceof Error ? causa.message : 'Não foi possível gerar o link.');
    } finally {
      setGerando(false);
    }
  }

  const digitos = (telefone ?? '').replace(/\D/g, '');
  const mensagem = `Olá${nome ? `, ${nome}` : ''}! Para completar seu cadastro com a Tela Viva, preencha seus dados neste link pessoal: ${link}`;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-base">
        Mande um link para o contato completar o cadastro (CNPJ ou CPF, razão social e endereço). O
        que ele enviar entra direto nesta ficha.
      </p>
      <button type="button" className="btn" disabled={gerando} onClick={() => void gerar()}>
        {gerando ? 'Gerando…' : link ? 'Gerar outro link' : 'Gerar link para completar cadastro'}
      </button>
      {link ? (
        <>
          <input
            className="campo"
            aria-label="Link para completar cadastro"
            readOnly
            value={link}
            onFocus={(evento) => evento.currentTarget.select()}
          />
          {validade ? (
            <small className="text-sm">Vale até {validade} e para um envio.</small>
          ) : null}
          {digitos.length >= 10 ? (
            <a
              className="atalho"
              href={`https://wa.me/${digitos}?text=${encodeURIComponent(mensagem)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Enviar pelo WhatsApp
            </a>
          ) : null}
        </>
      ) : null}
      {aviso ? (
        <p className="text-base" role="status">
          {aviso}
        </p>
      ) : null}
    </div>
  );
}
