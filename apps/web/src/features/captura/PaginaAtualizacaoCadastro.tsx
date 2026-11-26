import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { urlDaApi } from '@/lib/api-url';
import { textoDaResposta } from '@/lib/texto-resposta';

type Tipo = 'PF' | 'PJ';

interface DadosAtualizacao {
  tipoPessoa: Tipo | '';
  nome: string;
  email: string;
  telefone: string;
  cpf: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
}

interface Lido extends Omit<DadosAtualizacao, 'cpf' | 'cnpj'> {
  cpfMascarado?: string;
  cnpjMascarado?: string;
  mensagem?: string;
}

const vazio: DadosAtualizacao = {
  tipoPessoa: '',
  nome: '',
  email: '',
  telefone: '',
  cpf: '',
  cnpj: '',
  razaoSocial: '',
  nomeFantasia: '',
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
};

/** Link pessoal para o titular completar o cadastro inteiro (ADR-034). */
export function PaginaAtualizacaoCadastro() {
  const { token = '' } = useParams();
  const [dados, setDados] = useState<DadosAtualizacao>(vazio);
  const [mascaras, setMascaras] = useState({ cpf: '', cnpj: '' });
  const [carregando, setCarregando] = useState(true);
  const [linkInvalido, setLinkInvalido] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [concluido, setConcluido] = useState(false);

  useEffect(() => {
    void fetch(urlDaApi(`/v1/publico/atualizar-cadastro/${encodeURIComponent(token)}`))
      .then(async (resposta) => {
        const json = (await resposta.json().catch(() => null)) as Lido | null;
        if (!resposta.ok || !json)
          throw new Error(textoDaResposta(json ?? {}, 'Não foi possível abrir este link.'));
        setDados({
          ...vazio,
          ...Object.fromEntries(
            Object.entries(json).filter(([chave, valor]) => chave in vazio && valor != null),
          ),
          tipoPessoa: json.tipoPessoa === 'PF' ? 'PF' : 'PJ',
          cpf: '',
          cnpj: '',
        });
        setMascaras({ cpf: json.cpfMascarado ?? '', cnpj: json.cnpjMascarado ?? '' });
      })
      .catch((causa: unknown) =>
        setLinkInvalido(
          causa instanceof Error ? causa.message : 'Não foi possível abrir este link.',
        ),
      )
      .finally(() => setCarregando(false));
  }, [token]);

  const mudar = (campo: keyof DadosAtualizacao) => (valor: string) =>
    setDados((antes) => ({ ...antes, [campo]: valor }));

  async function completarPeloCep(cep: string) {
    const digitos = cep.replace(/\D/g, '');
    if (digitos.length !== 8) return;
    setBuscandoCep(true);
    try {
      const resposta = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
      const json = (await resposta.json()) as {
        erro?: boolean;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
      };
      if (!resposta.ok || json.erro) return;
      setDados((antes) => ({
        ...antes,
        logradouro: json.logradouro || antes.logradouro,
        bairro: json.bairro || antes.bairro,
        cidade: json.localidade || antes.cidade,
        uf: json.uf || antes.uf,
      }));
    } catch {
      // Sem a busca, o titular digita o endereço; nada se perde.
    } finally {
      setBuscandoCep(false);
    }
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setErro('');
    setEnviando(true);
    const { cpf, cnpj, razaoSocial, nomeFantasia, ...comuns } = dados;
    const corpo =
      dados.tipoPessoa === 'PF'
        ? { ...comuns, cpf }
        : { ...comuns, cnpj, razaoSocial, nomeFantasia };
    try {
      const resposta = await fetch(
        urlDaApi(`/v1/publico/atualizar-cadastro/${encodeURIComponent(token)}`),
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(corpo),
        },
      );
      const json = await resposta.json().catch(() => null);
      if (!resposta.ok)
        throw new Error(textoDaResposta(json, 'Não foi possível confirmar seus dados.'));
      setConcluido(true);
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Não foi possível confirmar seus dados.');
    } finally {
      setEnviando(false);
    }
  }

  if (carregando) return <p className="text-base">Abrindo seus dados…</p>;
  if (linkInvalido)
    return (
      <p className="text-base" role="alert">
        {linkInvalido}
      </p>
    );
  if (concluido)
    return (
      <section className="flex flex-col gap-4" aria-live="polite">
        <h1 className="text-2xl font-semibold">Cadastro atualizado</h1>
        <p className="text-base">
          Obrigado. Recebemos seus dados e retornaremos para combinar a conversa.
        </p>
      </section>
    );

  const pj = dados.tipoPessoa !== 'PF';
  return (
    <section className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide">Tela Viva</p>
        <h1 className="mt-2 text-2xl font-semibold">Complete seu cadastro</h1>
        <p className="mt-2 text-base">
          Confira o que já temos e preencha o que faltar. Este link é pessoal e vale para um envio.
        </p>
      </div>
      <form className="cartao flex flex-col gap-4" onSubmit={(evento) => void enviar(evento)}>
        <fieldset className="flex flex-col gap-2 text-base">
          <legend className="font-semibold">O cadastro é de</legend>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="tipoPessoa"
              checked={pj}
              onChange={() => mudar('tipoPessoa')('PJ')}
            />
            Empresa ou estúdio (CNPJ)
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="tipoPessoa"
              checked={!pj}
              onChange={() => mudar('tipoPessoa')('PF')}
            />
            Pessoa física (CPF)
          </label>
        </fieldset>

        {pj ? (
          <>
            <Campo
              rotulo="CNPJ"
              valor={dados.cnpj}
              mudar={mudar('cnpj')}
              modo="numeric"
              ajuda={
                mascaras.cnpj
                  ? `Já temos o CNPJ ${mascaras.cnpj}. Deixe em branco para manter.`
                  : undefined
              }
            />
            <Campo rotulo="Razão social" valor={dados.razaoSocial} mudar={mudar('razaoSocial')} />
            <Campo
              rotulo="Nome fantasia (como o estúdio é conhecido)"
              valor={dados.nomeFantasia}
              mudar={mudar('nomeFantasia')}
            />
          </>
        ) : (
          <Campo
            rotulo="CPF"
            valor={dados.cpf}
            mudar={mudar('cpf')}
            modo="numeric"
            ajuda={
              mascaras.cpf
                ? `Já temos o CPF ${mascaras.cpf}. Deixe em branco para manter.`
                : undefined
            }
          />
        )}

        <Campo
          rotulo={pj ? 'Nome do responsável' : 'Nome'}
          valor={dados.nome}
          mudar={mudar('nome')}
        />
        <Campo rotulo="WhatsApp" tipo="tel" valor={dados.telefone} mudar={mudar('telefone')} />
        <Campo rotulo="E-mail" tipo="email" valor={dados.email} mudar={mudar('email')} />

        <fieldset className="flex flex-col gap-4">
          <legend className="text-base font-semibold">Endereço</legend>
          <Campo
            rotulo="CEP"
            valor={dados.cep}
            mudar={(cep) => {
              mudar('cep')(cep);
              void completarPeloCep(cep);
            }}
            modo="numeric"
            ajuda={buscandoCep ? 'Buscando o endereço pelo CEP…' : undefined}
          />
          <Campo rotulo="Rua / avenida" valor={dados.logradouro} mudar={mudar('logradouro')} />
          <Campo rotulo="Número" valor={dados.numero} mudar={mudar('numero')} />
          <Campo rotulo="Complemento" valor={dados.complemento} mudar={mudar('complemento')} />
          <Campo rotulo="Bairro" valor={dados.bairro} mudar={mudar('bairro')} />
          <Campo rotulo="Cidade" valor={dados.cidade} mudar={mudar('cidade')} />
          <Campo rotulo="UF" valor={dados.uf} mudar={mudar('uf')} maxLength={2} />
        </fieldset>

        {erro ? (
          <p className="text-base" role="alert">
            {erro}
          </p>
        ) : null}
        <button type="submit" className="btn" disabled={enviando}>
          {enviando ? 'Enviando…' : 'Enviar cadastro'}
        </button>
      </form>
    </section>
  );
}

function Campo({
  rotulo,
  valor,
  mudar,
  tipo = 'text',
  modo,
  maxLength,
  ajuda,
}: {
  rotulo: string;
  valor: string;
  mudar: (valor: string) => void;
  tipo?: string;
  modo?: 'numeric';
  maxLength?: number;
  ajuda?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-base">
      {rotulo}
      <input
        className="campo"
        type={tipo}
        inputMode={modo}
        value={valor}
        maxLength={maxLength}
        onChange={(evento) => mudar(evento.target.value)}
      />
      {ajuda ? <small className="text-sm">{ajuda}</small> : null}
    </label>
  );
}
