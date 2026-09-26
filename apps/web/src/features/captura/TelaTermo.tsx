import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { cabecalhosDaSessao } from '@/lib/offline/sessao';

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
  aoGuardarLocal?: (emDispositivo: string) => Promise<void>;
}) {
  const [texto, setTexto] = useState<TextoTermo | null>(null);
  const [marcado, setMarcado] = useState(false);
  const [completo, setCompleto] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [mensagem, setMensagem] = useState('');

  useEffect(() => {
    void fetch('/v1/publico/termo/atual')
      .then((resposta) => resposta.json())
      .then((json: { dados?: TextoTermo }) => {
        if (json.dados?.textoCurto) setTexto(json.dados);
      })
      .catch(() => setMensagem('Não consegui carregar o termo. Nada foi gravado.'));
  }, []);

  const curto = texto?.textoCurto ?? '';
  const destaque = linha(curto, 'Importante: este cadastro existe');
  const comercial = linha(curto, 'Contato comercial (necessário para concluir o cadastro)');

  async function concluir() {
    if (!marcado) return;
    const emDispositivo = new Date().toISOString();
    if (modo === 'vendedor' && !idServidor) {
      await aoGuardarLocal?.(emDispositivo);
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
        ? { token, nome, email, telefone, contatoComercial: true, emDispositivo }
        : { contatoComercial: true, emDispositivo };
    const resposta = await fetch(caminho, {
      method: 'POST',
      headers:
        modo === 'autocadastro' ? { 'content-type': 'application/json' } : cabecalhosDaSessao(),
      body: JSON.stringify(corpo),
    });
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
          'Importante: este cadastro existe para que a 7Safe possa entrar em contato com você para apresentar produtos e serviços. Por isso, sem a autorização de contato comercial abaixo não é possível concluir o cadastro. Você pode revogar essa autorização depois, a qualquer momento e de graça.'}
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
      {modo === 'autocadastro' ? (
        <div className="flex flex-col gap-3">
          <Campo rotulo="Nome" valor={nome} aoMudar={setNome} />
          <Campo rotulo="E-mail" valor={email} aoMudar={setEmail} />
          <Campo rotulo="Telefone" valor={telefone} aoMudar={setTelefone} />
        </div>
      ) : null}
      <pre className="whitespace-pre-wrap font-sans text-base">{curto}</pre>
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
          disabled={!marcado}
          onClick={() => void concluir()}
        >
          Concluir cadastro
        </button>
      </div>
      {completo ? (
        <pre className="whitespace-pre-wrap font-sans text-base">{texto?.textoCompleto}</pre>
      ) : null}
      {mensagem ? <p className="text-base">{mensagem}</p> : null}
      <p className="text-base">Versão do termo: {texto?.versao ?? '[A PREENCHER, D1]'}</p>
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
