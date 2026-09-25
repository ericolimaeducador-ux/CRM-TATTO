import { useEffect, useRef, useState } from 'react';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { Link, useLocation, useParams } from 'react-router-dom';
import { garantirContato, lerUm, observarFila, salvarCampo } from '@/lib/offline/fila';
import type { ContatoLocal } from '@/lib/offline/tipos';
import { IndicadorSincronizacao } from './IndicadorSincronizacao';

interface Campos {
  nome: string;
  telefone: string;
  email: string;
  cpf: string;
  cnpj: string;
  cep: string;
  logradouro: string;
  numero: string;
  cidade: string;
  uf: string;
  observacoes: string;
}

const VAZIO: Campos = {
  nome: '',
  telefone: '',
  email: '',
  cpf: '',
  cnpj: '',
  cep: '',
  logradouro: '',
  numero: '',
  cidade: '',
  uf: '',
  observacoes: '',
};

export function FormularioCaptura() {
  const { idLocal = '' } = useParams();
  const local = useLocation();
  const naoReconhecido = Boolean(
    (local.state as { naoReconhecido?: boolean } | null)?.naoReconhecido,
  );
  const [contato, setContato] = useState<ContatoLocal | null>(null);
  const ultimo = useRef<Record<string, string>>({});
  const pronto = useRef(false);
  const { register, watch, reset } = useForm<Campos>({ defaultValues: VAZIO });
  const valores = watch();
  const valoresRef = useRef(valores);
  valoresRef.current = valores;

  useEffect(() => {
    pronto.current = false;
    void garantirContato(idLocal).then(async (criado) => {
      const atual = (await lerUm(idLocal)) ?? criado;
      setContato(atual);
      const base = { ...VAZIO, ...atual.campos };
      const campos = { ...base, ...lerPendente(idLocal) };
      ultimo.current = base;
      pronto.current = true;
      reset(campos);
    });
    return observarFila(() => {
      void lerUm(idLocal).then((atual) => {
        if (atual) setContato(atual);
      });
    });
  }, [idLocal, reset]);

  useEffect(() => {
    if (!pronto.current) return;
    const atuais = valores;
    const aoSair = () => {
      const agora = valoresRef.current;
      const sujo = (Object.keys(VAZIO) as (keyof Campos)[]).some(
        (campo) => agora[campo] !== (ultimo.current[campo] ?? ''),
      );
      if (sujo) gravarPendente(idLocal, agora);
    };
    window.addEventListener('pagehide', aoSair);
    const timer = window.setTimeout(
      () => void gravarCampos(idLocal, atuais, ultimo, valoresRef, setContato),
      800,
    );
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pagehide', aoSair);
      void gravarCampos(idLocal, atuais, ultimo, valoresRef, setContato);
    };
  }, [valores, idLocal]);

  return (
    <section className="flex flex-col gap-4">
      <Link className="inline-flex min-h-12 items-center text-base underline" to="/capturar">
        Captura
      </Link>
      <h1 className="text-2xl font-semibold">Contato</h1>
      {contato ? <IndicadorSincronizacao estado={contato.estado} /> : null}
      {naoReconhecido ? (
        <p className="text-base text-amber-900">
          Não reconheci o QR. O texto ficou guardado e o formulário abre em branco.
        </p>
      ) : null}
      <label className="flex flex-col gap-1 text-base">
        Nome
        <input
          className="min-h-12 rounded border border-stone-300 px-3"
          autoFocus
          {...register('nome')}
        />
      </label>
      <details className="rounded border border-stone-300 p-3">
        <summary className="min-h-12 cursor-pointer text-base">Contato</summary>
        <Campo rotulo="Telefone" registro={register('telefone')} />
        <Campo rotulo="E-mail" registro={register('email')} />
      </details>
      <details className="rounded border border-stone-300 p-3">
        <summary className="min-h-12 cursor-pointer text-base">Documento</summary>
        <Campo rotulo="CPF" registro={register('cpf')} />
        <Campo rotulo="CNPJ" registro={register('cnpj')} />
      </details>
      <details className="rounded border border-stone-300 p-3">
        <summary className="min-h-12 cursor-pointer text-base">Endereço</summary>
        <Campo rotulo="CEP" registro={register('cep')} />
        <Campo rotulo="Logradouro" registro={register('logradouro')} />
        <Campo rotulo="Número" registro={register('numero')} />
        <Campo rotulo="Cidade" registro={register('cidade')} />
        <Campo rotulo="UF" registro={register('uf')} />
      </details>
      <details className="rounded border border-stone-300 p-3">
        <summary className="min-h-12 cursor-pointer text-base">Observações</summary>
        <Campo rotulo="Notas" registro={register('observacoes')} />
      </details>
    </section>
  );
}

async function gravarCampos(
  idLocal: string,
  atuais: Campos,
  ultimo: { current: Record<string, string> },
  valoresRef: { current: Campos },
  definir: (contato: ContatoLocal) => void,
): Promise<void> {
  const alterados = (Object.keys(VAZIO) as (keyof Campos)[]).filter(
    (campo) => atuais[campo] !== ultimo.current[campo],
  );
  if (alterados.length === 0) return;
  for (const campo of alterados) ultimo.current[campo] = atuais[campo];
  const foto = JSON.stringify(atuais);
  for (const campo of alterados) definir(await salvarCampo(idLocal, campo, atuais[campo]));
  if (JSON.stringify(valoresRef.current) === foto) limparPendente(idLocal);
}

function chavePendente(idLocal: string): string {
  return `captura7.rascunho.${idLocal}`;
}

function gravarPendente(idLocal: string, campos: Campos): void {
  localStorage.setItem(chavePendente(idLocal), JSON.stringify(campos));
}

function limparPendente(idLocal: string): void {
  localStorage.removeItem(chavePendente(idLocal));
}

function lerPendente(idLocal: string): Partial<Campos> {
  const bruto = localStorage.getItem(chavePendente(idLocal));
  if (!bruto) return {};
  try {
    const json: unknown = JSON.parse(bruto);
    if (!json || typeof json !== 'object') return {};
    const saida: Partial<Campos> = {};
    for (const chave of Object.keys(VAZIO) as (keyof Campos)[]) {
      const valor = (json as Record<string, unknown>)[chave];
      if (typeof valor === 'string') saida[chave] = valor;
    }
    return saida;
  } catch {
    return {};
  }
}

function Campo({ rotulo, registro }: { rotulo: string; registro: UseFormRegisterReturn }) {
  return (
    <label className="mt-3 flex flex-col gap-1 text-base">
      {rotulo}
      <input className="min-h-12 rounded border border-stone-300 px-3" {...registro} />
    </label>
  );
}
