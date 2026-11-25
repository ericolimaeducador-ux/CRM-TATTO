import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { urlDaApi } from '@/lib/api-url';
import { textoDaResposta } from '@/lib/texto-resposta';

interface DadosAtualizacao {
  nome: string;
  email: string;
  telefone: string;
  cidade: string;
  uf: string;
}

const vazio: DadosAtualizacao = { nome: '', email: '', telefone: '', cidade: '', uf: '' };

export function PaginaAtualizacaoCadastro() {
  const { token = '' } = useParams();
  const [dados, setDados] = useState<DadosAtualizacao>(vazio);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [concluido, setConcluido] = useState(false);

  useEffect(() => {
    void fetch(urlDaApi(`/v1/publico/atualizar-cadastro/${encodeURIComponent(token)}`))
      .then(async (resposta) => {
        const json = await resposta.json().catch(() => null);
        if (!resposta.ok)
          throw new Error(textoDaResposta(json, 'Não foi possível abrir este link.'));
        setDados(json as DadosAtualizacao);
      })
      .catch((causa: unknown) =>
        setErro(causa instanceof Error ? causa.message : 'Não foi possível abrir este link.'),
      )
      .finally(() => setCarregando(false));
  }, [token]);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setErro('');
    try {
      const resposta = await fetch(
        urlDaApi(`/v1/publico/atualizar-cadastro/${encodeURIComponent(token)}`),
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(dados),
        },
      );
      const json = await resposta.json().catch(() => null);
      if (!resposta.ok)
        throw new Error(textoDaResposta(json, 'Não foi possível confirmar seus dados.'));
      setConcluido(true);
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Não foi possível confirmar seus dados.');
    }
  }

  if (carregando) return <p className="text-base">Abrindo seus dados…</p>;
  if (erro && !concluido)
    return (
      <p className="text-base" role="alert">
        {erro}
      </p>
    );
  if (concluido)
    return (
      <section className="flex flex-col gap-4" aria-live="polite">
        <h1 className="text-2xl font-semibold">Dados atualizados</h1>
        <p className="text-base">
          Obrigado. Recebemos sua atualização e retornaremos para combinar a conversa.
        </p>
      </section>
    );
  return (
    <section className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide">Tela Viva</p>
        <h1 className="mt-2 text-2xl font-semibold">Confirme seus dados</h1>
        <p className="mt-2 text-base">
          Atualize somente o que mudou. Este link é pessoal e pode ser usado uma vez.
        </p>
      </div>
      <form className="cartao flex flex-col gap-4" onSubmit={(evento) => void enviar(evento)}>
        <Campo rotulo="Nome" valor={dados.nome} mudar={(nome) => setDados({ ...dados, nome })} />
        <Campo
          rotulo="WhatsApp"
          tipo="tel"
          valor={dados.telefone}
          mudar={(telefone) => setDados({ ...dados, telefone })}
        />
        <Campo
          rotulo="E-mail"
          tipo="email"
          valor={dados.email}
          mudar={(email) => setDados({ ...dados, email })}
        />
        <Campo
          rotulo="Cidade"
          valor={dados.cidade}
          mudar={(cidade) => setDados({ ...dados, cidade })}
        />
        <Campo
          rotulo="UF"
          valor={dados.uf}
          mudar={(uf) => setDados({ ...dados, uf })}
          maxLength={2}
        />
        {erro ? (
          <p className="text-base" role="alert">
            {erro}
          </p>
        ) : null}
        <button type="submit" className="btn">
          Confirmar dados
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
  maxLength,
}: {
  rotulo: string;
  valor: string;
  mudar: (valor: string) => void;
  tipo?: string;
  maxLength?: number;
}) {
  return (
    <label className="flex flex-col gap-1 text-base">
      {rotulo}
      <input
        className="campo"
        type={tipo}
        value={valor}
        maxLength={maxLength}
        onChange={(evento) => mudar(evento.target.value)}
      />
    </label>
  );
}
