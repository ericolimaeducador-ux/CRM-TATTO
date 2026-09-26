import { useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { cabecalhosDaSessao } from '@/lib/offline/sessao';

export function MeuQr() {
  const [caminho, setCaminho] = useState('');
  const [imagem, setImagem] = useState('');
  const [mensagem, setMensagem] = useState('');

  async function gerar() {
    const resposta = await fetch('/v1/qr', {
      method: 'POST',
      headers: cabecalhosDaSessao(),
      body: '{}',
    });
    const json = (await resposta.json()) as {
      dados?: { caminho?: string };
      erros?: { mensagem?: string }[];
      mensagem?: string;
    };
    const recebido = json.dados?.caminho;
    if (!resposta.ok || !recebido) {
      setMensagem(
        json.erros?.[0]?.mensagem ?? json.mensagem ?? 'Não gerei o QR. Nada foi publicado.',
      );
      return;
    }
    const url = new URL(recebido, window.location.origin).toString();
    setCaminho(url);
    setImagem(await QRCode.toDataURL(url, { margin: 1, width: 240 }));
    setMensagem('O titular abre este endereço e marca as caixas. Elas começam desmarcadas.');
  }

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Meu QR</h1>
      <p className="text-base">
        O texto é a minuta interna. Ainda precisa de advogado e de validação de UX antes de uso
        externo.
      </p>
      <button
        type="button"
        className="min-h-12 rounded-lg bg-stone-900 px-4 text-base text-white"
        onClick={() => void gerar()}
      >
        Gerar QR de autocadastro
      </button>
      {imagem ? <img alt="QR do autocadastro" className="h-60 w-60" src={imagem} /> : null}
      {caminho ? (
        <a className="break-all text-base underline" href={caminho}>
          {caminho}
        </a>
      ) : null}
      {mensagem ? <p className="text-base">{mensagem}</p> : null}
      <Link className="inline-flex min-h-12 items-center text-base underline" to="/capturar">
        Voltar para capturar
      </Link>
    </section>
  );
}
