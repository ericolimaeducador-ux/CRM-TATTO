import { useEffect, useState } from 'react';
import {
  CalendarDays,
  CalendarRange,
  CloudUpload,
  List,
  NotebookTabs,
  Search,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { urlDaApi } from '@/lib/api-url';
import { lerTodos } from '@/lib/offline/fila';
import { cabecalhosDaSessao, tokenDaSessao } from '@/lib/offline/sessao';

interface Resumo {
  hoje: number;
  semana: number;
  porStatus: Record<string, number>;
}

const STATUS: { chave: string; icone: LucideIcon }[] = [
  { chave: 'rascunho', icone: List },
  { chave: 'capturado', icone: NotebookTabs },
  { chave: 'qualificado', icone: Search },
  { chave: 'cliente', icone: Users },
  { chave: 'descartado', icone: X },
];

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
  if (!resumo) {
    return (
      <div>
        <p className="sr-only">Carregando números…</p>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4" aria-hidden="true">
          <div className="esqueleto" />
          <div className="esqueleto" />
          <div className="esqueleto" />
        </div>
      </div>
    );
  }

  return (
    <section className="grid grid-cols-2 gap-4 md:grid-cols-4" aria-label="Resumo">
      <Numero rotulo="Hoje" valor={resumo.hoje} icone={CalendarDays} />
      <Numero rotulo="Nesta semana" valor={resumo.semana} icone={CalendarRange} />
      <Numero rotulo="Aguardando envio" valor={pendentes} icone={CloudUpload} />
      {STATUS.map((status) => (
        <Numero
          key={status.chave}
          rotulo={status.chave}
          valor={resumo.porStatus[status.chave] ?? 0}
          icone={status.icone}
        />
      ))}
    </section>
  );
}

function Numero({
  rotulo,
  valor,
  icone: Icone,
}: {
  rotulo: string;
  valor: number;
  icone: LucideIcon;
}) {
  return (
    <article className="cartao flex flex-col gap-2">
      <span className="resumo-icone">
        <Icone aria-hidden="true" />
      </span>
      <p
        className="font-marca text-4xl font-semibold leading-none"
        style={{ color: 'var(--petrol)' }}
      >
        {valor}
      </p>
      <p className="text-sm capitalize">{rotulo}</p>
    </article>
  );
}
