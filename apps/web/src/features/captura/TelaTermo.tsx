import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchComAcordar } from '@/lib/acordar';
import { urlDaApi } from '@/lib/api-url';
import { cabecalhosDaSessao } from '@/lib/offline/sessao';
import { DesafioCaptcha, tokenDoWidget } from './DesafioCaptcha';
import { limparMarcadores, MarkdownSimples } from './MarkdownSimples';

interface TextoTermo {
  versao: string;
  textoCurto: string;
  textoCompleto: string;
}

export function TelaTermo({
  modo,
  token,
  idServidor,
  aoGuardarLocal,
}: {
  modo: 'autocadastro' | 'vendedor';
  token?: string;
  idServidor?: string;
  aoGuardarLocal?: (emDispositivo: string, envioErp: boolean) => Promise<void>;
}) {
  const [texto, setTexto] = useState<TextoTermo | null>(null);
  const [marcado, setMarcado] = useState(false);
  const [completo, setCompleto] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [captchaId, setCaptchaId] = useState('');
  const [pergunta, setPergunta] = useState('');
  const [provedorCaptcha, setProvedorCaptcha] = useState('local');
  const [sitekey, setSitekey] = useState('');
  const [respostaCaptcha, setRespostaCaptcha] = useState('');
  const [envioErp, setEnvioErp] = useState(false);

  useEffect(() => {
    if (modo !== 'autocadastro') return;
    void fetchComAcordar(urlDaApi('/v1/publico/captcha'), undefined, setMensagem)
      .then((resposta) => resposta.json())
      .then(
        (json: {
          dados?: { id?: string; pergunta?: string; provedor?: string; sitekey?: string };
        }) => {
          if (json.dados?.provedor) setProvedorCaptcha(json.dados.provedor);
          if (json.dados?.sitekey) setSitekey(json.dados.sitekey);
          if (json.dados?.id && json.dados.pergunta) {
            setCaptchaId(json.dados.id);
            setPergunta(json.dados.pergunta);
          }
        },
      )
      .catch(() =>
        setMensagem(
          'Servidor acordando, aguarde… Não consegui carregar o desafio. Nada foi gravado.',
        ),
      );
  }, [modo]);

  useEffect(() => {
    void fetchComAcordar(urlDaApi('/v1/publico/termo/atual'), undefined, setMensagem)
      .then((resposta) => resposta.json())
      .then((json: { dados?: TextoTermo }) => {
        if (json.dados?.textoCurto) setTexto(json.dados);
      })
      .catch(() =>
        setMensagem(
          'Servidor acordando, aguarde… Não consegui carregar o termo. Nada foi gravado.',
        ),
      );
  }, []);

  const curto = texto?.textoCurto ?? '';
  const destaque = limparMarcadores(linha(curto, 'Importante: este cadastro existe'));
  const comercial = limparMarcadores(
    linha(curto, 'Contato comercial (necessário para concluir o cadastro)'),
  );
  const captchaExterno = modo === 'autocadastro' && provedorCaptcha !== 'local';
  const captchaLocalPendente =
    modo === 'autocadastro' &&
    provedorCaptcha === 'local' &&
    Boolean(captchaId) &&
    !respostaCaptcha.trim();
  const captchaExternoPendente = captchaExterno && !respostaCaptcha.trim();

  async function concluir() {
    if (!marcado) return;
    const emDispositivo = new Date().toISOString();
    if (modo === 'vendedor' && !idServidor) {
      await aoGuardarLocal?.(emDispositivo, envioErp);
      setMensagem(
        'A escolha do titular ficou neste aparelho, com o horário deste aparelho, e sobe com a fila.',
      );
      return;
    }
    const caminho =
      modo === 'autocadastro'
        ? '/v1/publico/autocadastro'
        : `/v1/contatos/${idServidor}/consentimento`;
    const corpo =
      modo === 'autocadastro'
        ? {
            token,
            nome,
            email,
            telefone,
            contatoComercial: true,
            envioErp,
            emDispositivo,
            captchaId,
            captchaResposta: provedorCaptcha === 'local' ? respostaCaptcha : undefined,
            captchaToken: provedorCaptcha === 'local' ? undefined : tokenDoWidget(respostaCaptcha),
          }
        : { contatoComercial: true, emDispositivo, envioErp };
    let resposta: Response;
    try {
      resposta = await fetchComAcordar(urlDaApi(caminho), {
        method: 'POST',
        headers:
          modo === 'autocadastro' ? { 'content-type': 'application/json' } : cabecalhosDaSessao(),
        body: JSON.stringify(corpo),
      });
    } catch {
      setMensagem('Servidor acordando, aguarde… Não concluí. Nada foi gravado.');
      return;
    }
    const json = (await resposta.json()) as {
      mensagem?: string;
      erros?: { mensagem?: string }[];
    };
    if (!resposta.ok) {
      setMensagem(json.erros?.[0]?.mensagem ?? json.mensagem ?? 'Não concluí. Nada foi gravado.');
      return;
    }
    setMensagem(
      modo === 'autocadastro'
        ? 'Cadastro concluído. A autorização de contato comercial ficou registrada.'
        : 'A autorização do titular ficou registrada.',
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Seus dados no captura7</h1>
      <p
        className="border-2 border-amber-800 bg-amber-50 p-3 text-base font-semibold"
        data-testid="destaque-consentimento"
      >
        {destaque ||
          'Importante: este cadastro existe para que o controlador, pessoa física, possa entrar em contato com você. O canal é o e-mail do controlador. Por isso, sem a autorização de contato comercial abaixo não é possível concluir o cadastro.'}
      </p>
      <label className="flex min-h-12 items-start gap-3 text-base">
        <input
          className="mt-1 h-6 w-6"
          type="checkbox"
          checked={marcado}
          onChange={(evento) => setMarcado(evento.target.checked)}
        />
        <span>{comercial || 'Contato comercial (necessário para concluir o cadastro).'}</span>
      </label>
      <label className="flex min-h-12 items-start gap-3 text-base">
        <input
          className="mt-1 h-6 w-6"
          type="checkbox"
          checked={envioErp}
          onChange={(evento) => setEnvioErp(evento.target.checked)}
        />
        <span>
          Envio a um sistema externo, opcional. Enquanto o controlador não configurar esse destino,
          esta caixa não envia nada.
        </span>
      </label>
      {modo === 'autocadastro' ? (
        <DesafioCaptcha
          provedor={provedorCaptcha}
          sitekey={sitekey}
          pergunta={pergunta}
          valor={respostaCaptcha}
          aoMudar={setRespostaCaptcha}
        />
      ) : null}
      {modo === 'autocadastro' ? (
        <div className="flex flex-col gap-3">
          <Campo rotulo="Nome" valor={nome} aoMudar={setNome} />
          <Campo rotulo="E-mail" valor={email} aoMudar={setEmail} />
          <Campo rotulo="Telefone" valor={telefone} aoMudar={setTelefone} />
        </div>
      ) : null}
      {curto ? <MarkdownSimples texto={curto} /> : null}
      <div className="flex flex-col gap-3">
        <button
          type="button"
          className="min-h-12 rounded-lg border border-stone-900 px-4 text-base"
          onClick={() => setCompleto((atual) => !atual)}
        >
          Ler o termo completo
        </button>
        <button
          type="button"
          className="min-h-12 rounded-lg bg-stone-900 px-4 text-base text-white disabled:opacity-40"
          disabled={!marcado || captchaLocalPendente || captchaExternoPendente}
          onClick={() => void concluir()}
        >
          Concluir cadastro
        </button>
      </div>
      {completo ? <MarkdownSimples texto={texto?.textoCompleto ?? ''} /> : null}
      {mensagem ? <p className="text-base">{mensagem}</p> : null}
      <p className="text-base">Versão do termo: {texto?.versao ?? '2026-09-26-uso-pessoal'}</p>
      {modo === 'vendedor' ? (
        <Link className="inline-flex min-h-12 items-center text-base underline" to="/capturar">
          Voltar para capturar
        </Link>
      ) : null}
    </section>
  );
}

function linha(texto: string, trecho: string): string {
  return (
    texto
      .split('\n')
      .find((item) => item.includes(trecho))
      ?.trim() ?? ''
  );
}

function Campo({
  rotulo,
  valor,
  aoMudar,
}: {
  rotulo: string;
  valor: string;
  aoMudar: (valor: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-base">
      {rotulo}
      <input
        className="min-h-12 rounded border border-stone-300 px-3"
        value={valor}
        onChange={(evento) => aoMudar(evento.target.value)}
      />
    </label>
  );
}
