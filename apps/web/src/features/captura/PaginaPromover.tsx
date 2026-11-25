import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { urlDaApi } from '@/lib/api-url';
import { cabecalhosDaSessao } from '@/lib/offline/sessao';

interface ContatoLido {
  nome?: string;
  status?: string;
  pf?: { cpfMascarado?: string };
  pj?: { cnpjMascarado?: string };
  enderecos?: { logradouro?: string; numero?: string; cidade?: string; uf?: string }[];
}

/**
 * Virar cliente exige: estar qualificado, CPF ou CNPJ e endereço completo (ADR-027).
 * A tela diz o que falta antes de pedir o código, para ninguém digitar o 2FA à toa (ADR-031).
 */
export function faltaParaCliente(c: ContatoLido): string[] {
  const faltam: string[] = [];
  if (c.status !== 'qualificado')
    faltam.push('estar qualificado (hoje está em ' + (c.status ?? '…') + ')');
  if (!c.pf?.cpfMascarado && !c.pj?.cnpjMascarado) faltam.push('CPF ou CNPJ');
  const endereco = (c.enderecos ?? []).some((e) => e.logradouro && e.numero && e.cidade && e.uf);
  if (!endereco) faltam.push('endereço completo (rua, número, cidade e UF)');
  return faltam;
}

export function PaginaPromover() {
  const { id = '' } = useParams();
  const [contato, setContato] = useState<ContatoLido | null>(null);
  const [codigo, setCodigo] = useState('');
  const [segredo, setSegredo] = useState('');
  const [mensagem, setMensagem] = useState('');

  useEffect(() => {
    void ler(id).then(setContato);
  }, [id]);

  const nome = contato?.nome || 'este contato';
  const status = contato?.status || 'o status atual';
  const faltam = contato ? faltaParaCliente(contato) : [];

  if (contato && faltam.length)
    return (
      <section className="flex flex-col gap-4">
        <Link className="atalho" to={`/lead/${id}`}>
          Voltar para a ficha
        </Link>
        <h1 className="text-2xl font-semibold">{nome} ainda não pode virar cliente</h1>
        <div className="cartao flex flex-col gap-2" aria-label="O que falta para virar cliente">
          <p className="text-base font-semibold">Falta:</p>
          <ul className="list-disc pl-6 text-base">
            {faltam.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <p className="text-base">
            Virar cliente é o último passo (proposta e nota fiscal). Para começar a trabalhar o
            contato, não precisa disso nem do código do autenticador.
          </p>
        </div>
        <div className="cartao flex flex-col gap-2">
          <p className="text-base font-semibold">O que fazer agora</p>
          <p className="text-base">
            Na ficha, use o bloco &quot;O que fazer com este contato&quot;: marque
            <strong> Interessado</strong> (ele entra na carteira) e escolha em
            <strong> Quem vai atender</strong> o vendedor responsável.
          </p>
          <Link className="btn" to={`/lead/${id}`}>
            Abrir a ficha de {nome}
          </Link>
        </div>
      </section>
    );

  return (
    <section className="flex flex-col gap-4">
      <Link className="atalho" to={`/lead/${id}`}>
        Voltar para a ficha
      </Link>
      <h1 className="text-2xl font-semibold">Promover a cliente</h1>
      <p className="text-base">
        {nome} está em {status}. Confirmar muda o status para cliente. É a única tela com campo
        obrigatório: o código do autenticador. A captura não pede isso, porque 2FA no meio do
        cadastro trava o vendedor.
      </p>
      <p className="text-base">
        Quem promove é a pessoa que entrou. O perfil vem dessa sessão. Confirme o código do
        autenticador dela.
      </p>
      <button
        type="button"
        className="btn-secundario"
        onClick={() => void inscrever(setSegredo, setMensagem)}
      >
        Inscrever autenticador deste usuário
      </button>
      <button
        type="button"
        className="btn-secundario"
        onClick={() => void ativar(codigo, setMensagem)}
      >
        Ativar autenticador
      </button>
      {segredo ? (
        <p className="text-base">
          Segredo mostrado uma vez. Guarde no autenticador e não cole em arquivo do projeto:{' '}
          {segredo}
        </p>
      ) : null}
      <form
        className="flex flex-col gap-3"
        onSubmit={(evento) => {
          evento.preventDefault();
          void promover(id, codigo, setMensagem);
        }}
      >
        <label className="flex flex-col gap-1 text-base" htmlFor="codigo-totp">
          Código TOTP obrigatório nesta tela
          <input
            id="codigo-totp"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            className="campo"
            value={codigo}
            onChange={(evento) => setCodigo(evento.target.value)}
          />
        </label>
        <button type="submit" className="btn">
          Promover {nome} a cliente
        </button>
      </form>
      {mensagem ? <p className="text-base">{mensagem}</p> : null}
    </section>
  );
}

async function ler(id: string): Promise<ContatoLido | null> {
  if (!id) return null;
  const resposta = await fetch(urlDaApi(`/v1/contatos/${id}`), { headers: cabecalhosDaSessao() });
  if (!resposta.ok) return null;
  const json = (await resposta.json()) as { dados?: ContatoLido };
  return json.dados ?? null;
}

async function inscrever(
  definirSegredo: (valor: string) => void,
  definirMensagem: (valor: string) => void,
): Promise<void> {
  const resposta = await fetch(urlDaApi('/v1/auth/totp/inscrever'), {
    method: 'POST',
    headers: cabecalhosDaSessao(),
  });
  const json = (await resposta.json()) as {
    dados?: { segredoBase32?: string };
    erros?: { mensagem: string }[];
    mensagem?: string;
  };
  if (!resposta.ok || !json.dados?.segredoBase32) {
    definirMensagem(json.erros?.[0]?.mensagem ?? json.mensagem ?? 'A inscrição não aconteceu.');
    return;
  }
  definirSegredo(json.dados.segredoBase32);
  definirMensagem(
    'Segredo pendente. Confirme um código válido em Ativar autenticador. Só depois a promoção aceita.',
  );
}

async function ativar(codigo: string, definirMensagem: (valor: string) => void): Promise<void> {
  const resposta = await fetch(urlDaApi('/v1/auth/totp/ativar'), {
    method: 'POST',
    headers: cabecalhosDaSessao(),
    body: JSON.stringify({ codigoTotp: codigo }),
  });
  const json = (await resposta.json()) as { erros?: { mensagem: string }[]; mensagem?: string };
  definirMensagem(
    resposta.ok
      ? 'Autenticador ativado. O próximo código serve para promover.'
      : (json.erros?.[0]?.mensagem ?? json.mensagem ?? 'O autenticador não foi ativado.'),
  );
}

async function promover(
  id: string,
  codigo: string,
  definirMensagem: (valor: string) => void,
): Promise<void> {
  const resposta = await fetch(urlDaApi(`/v1/contatos/${id}/transicao`), {
    method: 'POST',
    headers: cabecalhosDaSessao(),
    body: JSON.stringify({ para: 'cliente', codigoTotp: codigo }),
  });
  const json = (await resposta.json()) as {
    dados?: { status?: string };
    erros?: { mensagem: string }[];
    mensagem?: string;
  };
  if (!resposta.ok) {
    definirMensagem(
      json.erros?.[0]?.mensagem ??
        json.mensagem ??
        'A promoção não aconteceu. O status continua o mesmo.',
    );
    return;
  }
  definirMensagem(
    json.dados?.status === 'cliente'
      ? 'O contato agora é cliente.'
      : 'A resposta não confirmou o status cliente.',
  );
}
