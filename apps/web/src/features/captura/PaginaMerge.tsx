import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { cabecalhosDaSessao } from '@/lib/offline/sessao';

const CAMPOS = [
  ['nome', 'Nome'],
  ['emails', 'E-mail'],
  ['telefones', 'Telefone'],
  ['enderecos', 'Endereço'],
  ['pj.razaoSocial', 'Razão social'],
] as const;

export function PaginaMerge() {
  const { a = '', b = '' } = useParams();
  const [esquerda, setEsquerda] = useState<Record<string, unknown> | null>(null);
  const [direita, setDireita] = useState<Record<string, unknown> | null>(null);
  const [escolha, setEscolha] = useState<Record<string, string>>({});
  const [codigo, setCodigo] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [feito, setFeito] = useState(false);

  useEffect(() => {
    void Promise.all([ler(a), ler(b)]).then(([um, dois]) => {
      setEsquerda(um);
      setDireita(dois);
    });
  }, [a, b]);

  return (
    <section className="flex flex-col gap-4">
      <Link className="inline-flex min-h-12 items-center text-base underline" to="/duplicatas">
        Duplicatas
      </Link>
      <h1 className="text-2xl font-semibold">Fundir</h1>
      <p className="text-base">
        B será descartado e recuperável por 90 dias. Cada campo fica com o valor que você marcar.
        Não há fusão automática.
      </p>
      {CAMPOS.map(([campo, rotulo]) => (
        <fieldset key={campo} className="flex flex-col gap-2 rounded border border-stone-300 p-3">
          <legend className="text-base font-semibold">{rotulo}</legend>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Escolha
              nome={campo}
              valor="vencedor"
              texto={mostrar(esquerda, campo)}
              marcado={escolha[campo] !== 'absorvido'}
              aoMarcar={() => setEscolha({ ...escolha, [campo]: 'vencedor' })}
            />
            <Escolha
              nome={campo}
              valor="absorvido"
              texto={mostrar(direita, campo)}
              marcado={escolha[campo] === 'absorvido'}
              aoMarcar={() => setEscolha({ ...escolha, [campo]: 'absorvido' })}
            />
          </div>
        </fieldset>
      ))}
      <label className="flex flex-col gap-1 text-base">
        Código TOTP. Fora de produção, um código não vazio pede o passo extra por um atalho de
        teste. Em produção o servidor ignora esse atalho. A promoção a cliente confere o código.
        <input
          className="min-h-12 rounded border border-stone-300 px-3"
          value={codigo}
          onChange={(evento) => setCodigo(evento.target.value)}
        />
      </label>
      <button
        type="button"
        className="min-h-12 rounded-lg bg-stone-900 px-4 text-base text-white"
        onClick={() => void fundir(a, b, escolha, codigo, setMensagem, setFeito)}
      >
        Fundir com esta escolha
      </button>
      {feito ? (
        <button
          type="button"
          className="min-h-12 rounded-lg border border-stone-900 px-4 text-base"
          onClick={() => void recuperar(b, codigo, setMensagem)}
        >
          Recuperar o contato descartado
        </button>
      ) : null}
      {mensagem ? <p className="text-base">{mensagem}</p> : null}
    </section>
  );
}

function Escolha({
  nome,
  valor,
  texto,
  marcado,
  aoMarcar,
}: {
  nome: string;
  valor: string;
  texto: string;
  marcado: boolean;
  aoMarcar: () => void;
}) {
  return (
    <label className="flex min-h-12 flex-1 items-center gap-2 text-base">
      <input type="radio" name={nome} value={valor} checked={marcado} onChange={aoMarcar} />
      {texto || 'vazio'}
    </label>
  );
}

async function ler(id: string): Promise<Record<string, unknown> | null> {
  if (!id) return null;
  const resposta = await fetch(`/v1/contatos/${id}`, { headers: cabecalhosDaSessao() });
  if (!resposta.ok) return null;
  const json = (await resposta.json()) as { dados?: Record<string, unknown> };
  return json.dados ?? null;
}

async function fundir(
  a: string,
  b: string,
  escolha: Record<string, string>,
  codigo: string,
  definirMensagem: (texto: string) => void,
  definirFeito: (feito: boolean) => void,
): Promise<void> {
  const resposta = await fetch(`/v1/contatos/${a}/merge`, {
    method: 'POST',
    headers: cabecalhos(codigo),
    body: JSON.stringify({ absorvidoId: b, confirmacao: true, valoresEscolhidos: escolha }),
  });
  const json = (await resposta.json()) as { erros?: { mensagem: string }[] };
  if (!resposta.ok) {
    definirFeito(false);
    definirMensagem(
      mensagemDe(json, 'A fusão não aconteceu. Os dois contatos continuam como estavam.'),
    );
    return;
  }
  definirFeito(true);
  definirMensagem('O contato B foi descartado e pode ser recuperado por 90 dias.');
}

async function recuperar(
  id: string,
  codigo: string,
  definirMensagem: (texto: string) => void,
): Promise<void> {
  const resposta = await fetch(`/v1/contatos/${id}/recuperar`, {
    method: 'POST',
    headers: cabecalhos(codigo),
  });
  const json = (await resposta.json()) as { erros?: { mensagem: string }[] };
  definirMensagem(
    resposta.ok
      ? 'O contato descartado voltou ao status anterior.'
      : mensagemDe(json, 'A recuperação não aconteceu.'),
  );
}

function cabecalhos(codigo: string): Record<string, string> {
  const headers = cabecalhosDaSessao();
  if (codigo.trim()) headers['x-step-up-teste'] = '1';
  return headers;
}

function mensagemDe(
  json: { erros?: { mensagem: string }[]; mensagem?: string },
  reserva: string,
): string {
  return json.erros?.[0]?.mensagem ?? json.mensagem ?? reserva;
}

function mostrar(doc: Record<string, unknown> | null, campo: string): string {
  if (!doc) return '';
  if (campo === 'emails') return textoLista(doc.emails, 'valor');
  if (campo === 'telefones') return textoLista(doc.telefones, 'bruto');
  if (campo === 'enderecos') return textoLista(doc.enderecos, 'logradouro');
  if (campo === 'pj.razaoSocial') {
    const pj = doc.pj as { razaoSocial?: string } | undefined;
    return pj?.razaoSocial ?? '';
  }
  const valor = doc[campo];
  return typeof valor === 'string' ? valor : '';
}

function textoLista(valor: unknown, chave: string): string {
  if (!Array.isArray(valor) || !valor[0] || typeof valor[0] !== 'object') return '';
  const item = valor[0] as Record<string, unknown>;
  return typeof item[chave] === 'string' ? item[chave] : '';
}
