import { useEffect, useState } from 'react';
import { fetchComAcordar } from '@/lib/acordar';
import { urlDaApi } from '@/lib/api-url';
import { MarkdownSimples } from './MarkdownSimples';

interface TextoTermo {
  versao: string;
  textoCurto: string;
  textoCompleto: string;
}

// Página pública só de leitura: o formulário do QR abre o termo aqui, em outra aba.
export function PaginaTermoCompleto() {
  const [texto, setTexto] = useState<TextoTermo | null>(null);
  const [mensagem, setMensagem] = useState('Carregando o termo…');

  useEffect(() => {
    void fetchComAcordar(urlDaApi('/v1/publico/termo/atual'), undefined, setMensagem)
      .then((resposta) => resposta.json())
      .then((json: { dados?: TextoTermo }) => {
        if (json.dados?.textoCompleto || json.dados?.textoCurto) {
          setTexto(json.dados);
          setMensagem('');
        }
      })
      .catch(() => setMensagem('Não consegui carregar o termo. Tente de novo em instantes.'));
  }, []);

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Termo de uso dos seus dados</h1>
      {texto ? (
        <>
          {texto.textoCurto ? <MarkdownSimples texto={texto.textoCurto} /> : null}
          {texto.textoCompleto ? <MarkdownSimples texto={texto.textoCompleto} /> : null}
          <p className="text-base">Versão do termo: {texto.versao}</p>
        </>
      ) : null}
      {mensagem ? (
        <p className="text-base" role="status">
          {mensagem}
        </p>
      ) : null}
    </section>
  );
}
