import { useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { urlDaApi } from '@/lib/api-url';
import { cabecalhosDaSessao } from '@/lib/offline/sessao';

export function MeuQr() {
  const [caminho, setCaminho] = useState('');
  const [token, setToken] = useState('');
  const [imagem, setImagem] = useState('');
  const [mensagem, setMensagem] = useState('');

  async function gerar() {
    const resposta = await fetch(urlDaApi('/v1/qr'), {
      method: 'POST',
      headers: cabecalhosDaSessao(),
      body: '{}',
    });
    const json = (await resposta.json()) as {
      dados?: { caminho?: string; token?: string };
      erros?: { mensagem?: string }[];
      mensagem?: string;
    };
    const recebido = json.dados?.caminho;
    if (!resposta.ok || !recebido || !json.dados?.token) {
      setMensagem(
        json.erros?.[0]?.mensagem ?? json.mensagem ?? 'Não gerei o QR. Nada foi publicado.',
      );
      return;
    }
    const url = new URL(recebido, window.location.origin).toString();
    setToken(json.dados.token);
    setCaminho(url);
    setImagem(await QRCode.toDataURL(url, { margin: 1, width: 240 }));
    setMensagem('O titular abre este endereço e marca as caixas. Elas começam desmarcadas.');
  }

  async function revogar() {
    if (!token) return;
    const resposta = await fetch(urlDaApi(`/v1/qr/${token}/revogar`), {
      method: 'POST',
      headers: cabecalhosDaSessao(),
      body: '{}',
    });
    const json = (await resposta.json()) as { erros?: { mensagem?: string }[]; mensagem?: string };
    if (!resposta.ok) {
      setMensagem(json.erros?.[0]?.mensagem ?? json.mensagem ?? 'O QR continua válido.');
      return;
    }
    setImagem('');
    setCaminho('');
    setToken('');
    setMensagem('QR revogado. Esse endereço não conclui mais cadastro.');
  }

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Meu QR</h1>
      <p className="text-base">
        Quem estiver na mesma rede Wi-Fi abre o endereço deste computador. O QR vale duas horas e um
        cadastro.
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
      {token ? (
        <button
          type="button"
          className="min-h-12 rounded-lg border border-stone-900 px-4 text-base"
          onClick={() => void revogar()}
        >
          Revogar este QR
        </button>
      ) : null}
      {mensagem ? <p className="text-base">{mensagem}</p> : null}
      <Link className="inline-flex min-h-12 items-center text-base underline" to="/capturar">
        Voltar para capturar
      </Link>
    </section>
  );
}
