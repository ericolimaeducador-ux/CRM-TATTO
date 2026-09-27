import { useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { fetchComAcordar, FRASE_ACORDANDO } from '@/lib/acordar';
import { urlDaApi } from '@/lib/api-url';
import { hospedagemPublica, urlDoAplicativo } from '@/lib/base-publica';
import { cabecalhosDaSessao } from '@/lib/offline/sessao';

export function MeuQr() {
  const [caminho, setCaminho] = useState('');
  const [token, setToken] = useState('');
  const [imagem, setImagem] = useState('');
  const [mensagem, setMensagem] = useState('');

  async function gerar() {
    let resposta: Response;
    try {
      resposta = await fetchComAcordar(
        urlDaApi('/v1/qr'),
        { method: 'POST', headers: cabecalhosDaSessao(), body: '{}' },
        setMensagem,
      );
    } catch {
      setMensagem(`${FRASE_ACORDANDO} Não gerei o QR. Nada foi publicado.`);
      return;
    }
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
    const url = urlDoAplicativo(recebido);
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
        {hospedagemPublica()
          ? 'O titular abre o endereço abaixo. Este modo usa certificado válido, então não precisa instalar certificado no celular. O QR vale duas horas e um cadastro.'
          : 'Quem estiver na mesma rede Wi-Fi abre o endereço deste computador. Nesse modo o celular precisa da CA instalada. O QR vale duas horas e um cadastro.'}
      </p>
      <button type="button" className="btn" onClick={() => void gerar()}>
        Gerar QR de autocadastro
      </button>
      {imagem ? <img alt="QR do autocadastro" className="h-60 w-60" src={imagem} /> : null}
      {caminho ? (
        <a className="break-all text-base underline" href={caminho}>
          {caminho}
        </a>
      ) : null}
      {token ? (
        <button type="button" className="btn-secundario" onClick={() => void revogar()}>
          Revogar este QR
        </button>
      ) : null}
      {mensagem ? <p className="text-base">{mensagem}</p> : null}
      <Link className="atalho" to="/capturar">
        Voltar para capturar
      </Link>
    </section>
  );
}
