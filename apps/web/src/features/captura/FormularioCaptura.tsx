import { useEffect, useRef, useState } from 'react';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { Link, useLocation, useParams } from 'react-router-dom';
import { garantirContato, lerUm, observarFila, salvarCampo } from '@/lib/offline/fila';
import { cabecalhosDaSessao } from '@/lib/offline/sessao';
import type { ContatoLocal } from '@/lib/offline/tipos';
import { IndicadorSincronizacao } from './IndicadorSincronizacao';
import { PainelEnriquecimento } from './PainelEnriquecimento';

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
  const [statusServidor, setStatusServidor] = useState('');
  const ultimo = useRef<Record<string, string>>({});
  const pronto = useRef(false);
  const { register, watch, reset, setValue } = useForm<Campos>({ defaultValues: VAZIO });
  const valores = watch();
  const valoresRef = useRef(valores);
  const filaGravacao = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    const aoDigitar = (evento: Event) => {
      const el = evento.target;
      if (!(el instanceof HTMLInputElement) || !(el.name in VAZIO)) return;
      valoresRef.current = { ...valoresRef.current, [el.name]: el.value };
    };
    const aoSair = () => {
      const agora = valoresRef.current;
      const temAlgo = (Object.keys(VAZIO) as (keyof Campos)[]).some((campo) => agora[campo]);
      if (temAlgo) gravarPendente(idLocal, agora);
    };
    window.addEventListener('input', aoDigitar, true);
    window.addEventListener('pagehide', aoSair);
    return () => {
      window.removeEventListener('input', aoDigitar, true);
      window.removeEventListener('pagehide', aoSair);
      aoSair();
    };
  }, [idLocal]);

  useEffect(() => {
    pronto.current = false;
    let vivo = true;
    void garantirContato(idLocal).then(async (criado) => {
      if (!vivo) return;
      const atual = (await lerUm(idLocal)) ?? criado;
      if (!vivo) return;
      setContato(atual);
      const base = { ...VAZIO, ...atual.campos };
      const campos: Campos = { ...base, ...lerPendente(idLocal) };
      for (const campo of Object.keys(VAZIO) as (keyof Campos)[]) {
        if (valoresRef.current[campo]) campos[campo] = valoresRef.current[campo];
      }
      ultimo.current = base;
      valoresRef.current = campos;
      pronto.current = true;
      reset(campos);
    });
    const parar = observarFila(() => {
      void lerUm(idLocal).then((atual) => {
        if (atual) setContato(atual);
      });
    });
    return () => {
      vivo = false;
      parar();
    };
  }, [idLocal, reset]);

  useEffect(() => {
    if (!pronto.current) return;
    const gravar = () => {
      filaGravacao.current = filaGravacao.current
        .then(() => gravarCampos(idLocal, valoresRef.current, ultimo, valoresRef, setContato))
        .then(
          () => undefined,
          () => undefined,
        );
    };
    const timer = window.setTimeout(gravar, 800);
    return () => {
      window.clearTimeout(timer);
      gravar();
    };
  }, [valores, idLocal]);

  useEffect(() => {
    const idServidor = contato?.idServidor;
    if (!idServidor) return;
    void fetch(`/v1/contatos/${idServidor}`, { headers: cabecalhosDaSessao() })
      .then((resposta) => resposta.json())
      .then((json: { dados?: { lgpd?: { contatoComercial?: string } } }) => {
        const comercial = json.dados?.lgpd?.contatoComercial;
        if (comercial === 'pendente' || comercial === 'concedido' || comercial === 'revogado') {
          setStatusServidor(comercial);
        }
      })
      .catch(() => undefined);
  }, [contato?.idServidor]);

  return (
    <section className="flex flex-col gap-4">
      <Link className="inline-flex min-h-12 items-center text-base underline" to="/capturar">
        Captura
      </Link>
      <h1 className="text-2xl font-semibold">Contato</h1>
      <p className="border border-amber-800 bg-amber-50 p-3 text-base">
        {textoConsentimento(contato, statusServidor)}
      </p>
      <Link
        className="inline-flex min-h-12 items-center text-base underline"
        to={`/contatos/${idLocal}/termo`}
      >
        Autorizações do titular
      </Link>
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
      {contato ? (
        <PainelEnriquecimento
          idServidor={contato.idServidor}
          versaoServidor={contato.versaoServidor}
          cnpj={valores.cnpj}
          cep={valores.cep}
          aoUsarCampo={(campo, valor) => {
            if (campo in VAZIO) setValue(campo as keyof Campos, valor);
          }}
        />
      ) : null}
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
  if (JSON.stringify(valoresRef.current) === foto) limparPendenteSeIgual(idLocal, foto);
}

function chavePendente(idLocal: string): string {
  return `captura7.rascunho.${idLocal}`;
}

function gravarPendente(idLocal: string, campos: Campos): void {
  localStorage.setItem(chavePendente(idLocal), JSON.stringify(campos));
}

function limparPendenteSeIgual(idLocal: string, foto: string): void {
  if (localStorage.getItem(chavePendente(idLocal)) === foto) {
    localStorage.removeItem(chavePendente(idLocal));
  }
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

function textoConsentimento(contato: ContatoLocal | null, statusServidor: string): string {
  const status =
    statusServidor ||
    (contato?.consentimento?.contatoComercial
      ? 'escolha neste aparelho, ainda sem confirmação do servidor'
      : 'pendente');
  if (status === 'concedido') return 'Consentimento de contato comercial: concedido.';
  if (status === 'revogado') {
    return 'Consentimento de contato comercial: revogado. Contato comercial, envio ao ERP e exportação seguem bloqueados.';
  }
  if (status === 'pendente') {
    return 'Consentimento de contato comercial: pendente. O lead pode ficar salvo assim. Contato comercial, envio ao ERP e exportação seguem bloqueados até o titular autorizar.';
  }
  return `Consentimento de contato comercial: ${status}.`;
}

function Campo({ rotulo, registro }: { rotulo: string; registro: UseFormRegisterReturn }) {
  return (
    <label className="mt-3 flex flex-col gap-1 text-base">
      {rotulo}
      <input className="min-h-12 rounded border border-stone-300 px-3" {...registro} />
    </label>
  );
}
