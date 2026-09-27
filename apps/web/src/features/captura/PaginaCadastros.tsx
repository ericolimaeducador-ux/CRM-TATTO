import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SlidersHorizontal } from 'lucide-react';
import { brDeIso, dataBr, isoDeBr } from '@/lib/datas';
import { perfilLogado } from '@/lib/offline/sessao';
import {
  CampoData,
  carregar,
  chipsDe,
  CONSENTIMENTOS,
  documento,
  Esqueleto,
  nomeDe,
  ORDENS,
  ORIGENS,
  PESSOAS,
  Selecao,
  STATUS,
  Status,
  textoContagem,
  useTabela,
  VAZIO,
  Vazio,
  type Cadastro,
  type Filtros,
} from './cadastros-apoio';

export function PaginaCadastros() {
  const [rascunho, setRascunho] = useState<Filtros>(VAZIO);
  const [filtros, setFiltros] = useState<Filtros>(VAZIO);
  const [gaveta, setGaveta] = useState(false);
  const [itens, setItens] = useState<Cadastro[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [proximo, setProximo] = useState<string | null>(null);
  const [pilha, setPilha] = useState<(string | null)[]>([]);
  const [mensagem, setMensagem] = useState('');
  const [carregando, setCarregando] = useState(true);
  const perfil = perfilLogado();
  const tabela = useTabela();

  useEffect(() => {
    void carregar(filtros, cursor, setItens, setTotal, setProximo, setMensagem, setCarregando);
  }, [filtros, cursor]);

  function aplicar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const desde = isoDeBr(rascunho.desde);
    const ate = isoDeBr(rascunho.ate);
    if ((rascunho.desde && !desde) || (rascunho.ate && !ate)) {
      setMensagem('Use a data no formato dd/mm/aaaa.');
      return;
    }
    setMensagem('');
    setPilha([]);
    setCursor(null);
    setFiltros({ ...rascunho, desde, ate });
    setGaveta(false);
  }

  function limparChip(chave: keyof Filtros) {
    const proximoFiltro = { ...filtros, [chave]: chave === 'ordem' ? 'recente' : '' };
    setFiltros(proximoFiltro);
    setRascunho({
      ...proximoFiltro,
      desde: brDeIso(proximoFiltro.desde),
      ate: brDeIso(proximoFiltro.ate),
    });
    setPilha([]);
    setCursor(null);
  }

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold">Cadastros</h1>
        <p className="text-base">
          {perfil
            ? 'Leads gravados no servidor. O documento aparece mascarado nesta lista.'
            : 'Entre como gestor ou administrador para ver os cadastros do servidor.'}
        </p>
        <p className="text-base font-semibold" aria-live="polite">
          {carregando && itens.length === 0
            ? 'Carregando cadastros…'
            : textoContagem(total, itens.length)}
        </p>
      </header>
      <form className="flex flex-col gap-3" onSubmit={aplicar}>
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="flex flex-1 flex-col gap-1 text-base">
            Busca
            <input
              className="campo"
              name="q"
              value={rascunho.q}
              onChange={(evento) => setRascunho({ ...rascunho, q: evento.target.value })}
            />
          </label>
          <div className="flex items-end gap-2">
            <button type="submit" className="btn">
              Buscar
            </button>
            <button
              type="button"
              className="btn-secundario"
              aria-expanded={gaveta}
              onClick={() => setGaveta((valor) => !valor)}
            >
              <SlidersHorizontal aria-hidden="true" />
              Filtros
            </button>
          </div>
        </div>
        <div className={gaveta ? 'gaveta aberta' : 'gaveta'}>
          <div className="mb-2 flex items-center justify-between">
            <p className="font-marca text-xl">Filtros</p>
            <button type="button" className="btn-secundario" onClick={() => setGaveta(false)}>
              Fechar
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Selecao
              nome="status"
              rotulo="Status"
              valor={rascunho.status}
              opcoes={['', ...STATUS]}
              aoMudar={(valor) => setRascunho({ ...rascunho, status: valor })}
            />
            <Selecao
              nome="origem"
              rotulo="Origem"
              valor={rascunho.origem}
              opcoes={ORIGENS}
              aoMudar={(valor) => setRascunho({ ...rascunho, origem: valor })}
            />
            <Selecao
              nome="pessoa"
              rotulo="Pessoa"
              valor={rascunho.pessoa}
              opcoes={PESSOAS}
              aoMudar={(valor) => setRascunho({ ...rascunho, pessoa: valor })}
            />
            <Selecao
              nome="consentimento"
              rotulo="Consentimento"
              valor={rascunho.consentimento}
              opcoes={CONSENTIMENTOS}
              aoMudar={(valor) => setRascunho({ ...rascunho, consentimento: valor })}
            />
            <CampoData
              rotulo="Desde"
              valor={rascunho.desde}
              aoMudar={(valor) => setRascunho({ ...rascunho, desde: valor })}
            />
            <CampoData
              rotulo="Até"
              valor={rascunho.ate}
              aoMudar={(valor) => setRascunho({ ...rascunho, ate: valor })}
            />
            <Selecao
              nome="ordem"
              rotulo="Ordem"
              valor={rascunho.ordem}
              opcoes={ORDENS}
              aoMudar={(valor) => setRascunho({ ...rascunho, ordem: valor })}
            />
          </div>
          <button className="btn mt-3" type="submit">
            Aplicar filtros
          </button>
        </div>
      </form>
      <ul className="flex flex-wrap gap-2" aria-label="Filtros ativos">
        {chipsDe(filtros).map((chip) => (
          <li key={chip.chave}>
            <button type="button" className="chip" onClick={() => limparChip(chip.chave)}>
              {chip.rotulo} ×
            </button>
          </li>
        ))}
      </ul>
      {mensagem ? <p className="text-base">{mensagem}</p> : null}
      {carregando && itens.length === 0 ? <Esqueleto /> : null}
      {!carregando && !mensagem && itens.length === 0 ? <Vazio /> : null}
      {tabela ? (
        <table className="tabela">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Status</th>
              <th>Pessoa</th>
              <th>Documento</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((item) => (
              <tr key={item._id}>
                <td>
                  <Link className="atalho" to={`/lead/${item._id}`}>
                    {nomeDe(item)}
                  </Link>
                </td>
                <td>
                  <Status valor={item.status} />
                </td>
                <td>{item.tipoPessoa ?? 'INDEFINIDO'}</td>
                <td>{documento(item)}</td>
                <td>{dataBr(item.criadoEm)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <ul className="lista-cards">
          {itens.map((item) => (
            <li key={item._id} className="cartao flex flex-col gap-2">
              <Link className="atalho" to={`/lead/${item._id}`}>
                {nomeDe(item)}
              </Link>
              <div className="flex flex-wrap items-center gap-2">
                <Status valor={item.status} />
                <span className="chip">{item.tipoPessoa ?? 'INDEFINIDO'}</span>
                <span className="text-sm">{dataBr(item.criadoEm)}</span>
              </div>
              <p className="text-sm">{documento(item)}</p>
            </li>
          ))}
        </ul>
      )}
      {itens.length > 0 ? (
        <nav className="flex items-center justify-between gap-3" aria-label="Páginas">
          <button
            type="button"
            className="btn-secundario"
            disabled={pilha.length === 0}
            onClick={() => {
              const previo = pilha.at(-1) ?? null;
              setPilha((atual) => atual.slice(0, -1));
              setCursor(previo);
            }}
          >
            Anterior
          </button>
          <button
            type="button"
            className="btn-secundario"
            disabled={!proximo}
            onClick={() => {
              if (!proximo) return;
              setPilha((atual) => [...atual, cursor]);
              setCursor(proximo);
            }}
          >
            Próxima
          </button>
        </nav>
      ) : null}
    </section>
  );
}
