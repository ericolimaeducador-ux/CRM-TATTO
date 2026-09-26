import { useEffect, useRef, useState } from 'react';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { urlDaApi } from '@/lib/api-url';
import { apagarRascunhoLocal, lerUm, observarFila } from '@/lib/offline/fila';
import { cabecalhosDaSessao, podeAuditar, podeGerir } from '@/lib/offline/sessao';
import type { ContatoLocal } from '@/lib/offline/tipos';
import { IndicadorSincronizacao } from './IndicadorSincronizacao';
import { PainelEnriquecimento } from './PainelEnriquecimento';
import {
  Campo,
  VAZIO,
  type Campos,
  esquecerPendente,
  gravarCampos,
  gravarPendente,
  lerPendente,
  textoConsentimento,
} from './formulario-apoio';

export function FormularioCaptura() {
  const { idLocal = '' } = useParams();
  const navegar = useNavigate();
  const local = useLocation();
  const naoReconhecido = Boolean(
    (local.state as { naoReconhecido?: boolean } | null)?.naoReconhecido,
  );
  const [contato, setContato] = useState<ContatoLocal | null>(null);
  const [statusServidor, setStatusServidor] = useState('');
  const ultimo = useRef<Record<string, string>>({});
  const pronto = useRef(false);
  const apagado = useRef(false);
  const { register, watch, reset, setValue } = useForm<Campos>({ defaultValues: VAZIO });
  const valores = watch();
  const valoresRef = useRef(valores);
  const filaGravacao = useRef<Promise<void>>(Promise.resolve());
  const tipo = valores.tipoPessoa || 'INDEFINIDO';

  useEffect(() => {
    const aoDigitar = (evento: Event) => {
      const el = evento.target;
      if (!(el instanceof HTMLInputElement) || !(el.name in VAZIO)) return;
      valoresRef.current = { ...valoresRef.current, [el.name]: el.value };
    };
    const aoSair = () => {
      if (apagado.current) return;
      const agora = valoresRef.current;
      const temAlgo = (Object.keys(VAZIO) as (keyof Campos)[]).some((campo) =>
        campo === 'tipoPessoa'
          ? agora[campo] === 'PF' || agora[campo] === 'PJ'
          : agora[campo].trim(),
      );
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
    apagado.current = false;
    let vivo = true;
    void lerUm(idLocal).then((atual) => {
      if (!vivo) return;
      setContato(atual ?? null);
      const base = { ...VAZIO, ...atual?.campos };
      const campos: Campos = { ...base, ...lerPendente(idLocal) };
      for (const campo of Object.keys(VAZIO) as (keyof Campos)[]) {
        if (valoresRef.current[campo] && valoresRef.current[campo] !== VAZIO[campo]) {
          campos[campo] = valoresRef.current[campo];
        }
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
    if (!pronto.current || apagado.current) return;
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
    void fetch(urlDaApi(`/v1/contatos/${idServidor}`), { headers: cabecalhosDaSessao() })
      .then((resposta) => resposta.json())
      .then((json: { dados?: { lgpd?: { contatoComercial?: string } } }) => {
        const comercial = json.dados?.lgpd?.contatoComercial;
        if (comercial === 'pendente' || comercial === 'concedido' || comercial === 'revogado') {
          setStatusServidor(comercial);
        }
      })
      .catch(() => undefined);
  }, [contato?.idServidor]);

  async function excluirRascunho() {
    apagado.current = true;
    esquecerPendente(idLocal);
    const apagou = await apagarRascunhoLocal(idLocal);
    if (!apagou) {
      apagado.current = false;
      return;
    }
    navegar('/contatos');
  }

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
      {contato?.mensagem ? <p className="text-base text-amber-900">{contato.mensagem}</p> : null}
      {contato?.avisos?.map((aviso) => (
        <p key={`${aviso.codigo}-${aviso.campo}`} className="text-base text-amber-900">
          {aviso.mensagem}
        </p>
      ))}
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
      <fieldset className="flex flex-col gap-2 rounded border border-stone-300 p-3">
        <legend className="text-base">Tipo de pessoa</legend>
        <Opcao valor="INDEFINIDO" rotulo="Ainda não sei" registro={register('tipoPessoa')} />
        <Opcao valor="PF" rotulo="Pessoa física" registro={register('tipoPessoa')} />
        <Opcao valor="PJ" rotulo="Pessoa jurídica" registro={register('tipoPessoa')} />
      </fieldset>
      <details className="rounded border border-stone-300 p-3">
        <summary className="min-h-12 cursor-pointer text-base">Contato</summary>
        <Campo rotulo="Telefone" registro={register('telefone')} />
        <Campo rotulo="E-mail" registro={register('email')} />
      </details>
      {tipo === 'PF' ? (
        <details className="rounded border border-stone-300 p-3" open>
          <summary className="min-h-12 cursor-pointer text-base">
            Documento da pessoa física
          </summary>
          <Campo rotulo="CPF" registro={register('cpf')} />
        </details>
      ) : null}
      {tipo === 'PJ' ? (
        <details className="rounded border border-stone-300 p-3" open>
          <summary className="min-h-12 cursor-pointer text-base">
            Documento da pessoa jurídica
          </summary>
          <Campo rotulo="CNPJ" registro={register('cnpj')} />
          <Campo rotulo="Razão social" registro={register('razaoSocial')} />
          <Campo rotulo="Nome fantasia" registro={register('nomeFantasia')} />
        </details>
      ) : null}
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
      {contato?.idServidor && podeGerir() ? (
        <Link
          className="inline-flex min-h-12 items-center text-base underline"
          to={`/promover/${contato.idServidor}`}
        >
          Promover a cliente
        </Link>
      ) : null}
      {contato?.idServidor && podeAuditar() ? (
        <Link
          className="inline-flex min-h-12 items-center text-base underline"
          to={`/lead/${contato.idServidor}`}
        >
          Qualificar, descartar ou auditar
        </Link>
      ) : null}
      {contato && !contato.idServidor ? (
        <button
          type="button"
          className="min-h-12 rounded-lg border border-stone-900 px-4 text-base"
          onClick={() => void excluirRascunho()}
        >
          Excluir rascunho deste aparelho
        </button>
      ) : null}
    </section>
  );
}

function Opcao({
  valor,
  rotulo,
  registro,
}: {
  valor: string;
  rotulo: string;
  registro: UseFormRegisterReturn;
}) {
  return (
    <label className="flex min-h-12 items-center gap-2 text-base">
      <input type="radio" value={valor} {...registro} />
      {rotulo}
    </label>
  );
}
