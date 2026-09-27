import { useEffect, useState } from 'react';
import { urlDaApi } from '@/lib/api-url';
import { lerTodos } from '@/lib/offline/fila';
import { cabecalhosDaSessao, tokenDaSessao } from '@/lib/offline/sessao';

interface Resumo {
  hoje: number;
  semana: number;
  porStatus: Record<string, number>;
}

const STATUS = ['rascunho', 'capturado', 'qualificado', 'cliente', 'descartado'] as const;

export function PainelResumo() {
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [pendentes, setPendentes] = useState(0);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!tokenDaSessao()) return;
    let vivo = true;
    void fetch(urlDaApi('/v1/contatos/resumo'), { headers: cabecalhosDaSessao() })
      .then(async (resposta) => {
        const json = (await resposta.json()) as {
          dados?: Resumo;
          erros?: { mensagem?: string }[];
          mensagem?: string;
        };
        if (!vivo) return;
        if (!resposta.ok || !json.dados) {
          setErro(json.erros?.[0]?.mensagem ?? json.mensagem ?? 'Não consegui ler os números.');
          return;
        }
        setResumo(json.dados);
      })
      .catch(() => {
        if (vivo) setErro('Não consegui ler os números.');
      });
    void lerTodos()
      .then((itens) => {
        if (vivo) setPendentes(itens.filter((item) => item.estado !== 'sincronizado').length);
      })
      .catch(() => {
        if (vivo) setPendentes(0);
      });
    return () => {
      vivo = false;
    };
  }, []);

  if (!tokenDaSessao()) return null;
  if (erro) return <p className="text-base">{erro}</p>;
  if (!resumo) return <p className="text-base">Carregando números…</p>;

  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Resumo">
      <Numero rotulo="Hoje" valor={resumo.hoje} />
      <Numero rotulo="Nesta semana" valor={resumo.semana} />
      <Numero rotulo="Aguardando envio" valor={pendentes} />
      {STATUS.map((status) => (
        <Numero key={status} rotulo={status} valor={resumo.porStatus[status] ?? 0} />
      ))}
    </section>
  );
}

function Numero({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <article className="cartao">
      <p className="text-sm capitalize" style={{ color: 'var(--lilas)' }}>
        {rotulo}
      </p>
      <p className="font-marca text-3xl font-semibold">{valor}</p>
    </article>
  );
}
