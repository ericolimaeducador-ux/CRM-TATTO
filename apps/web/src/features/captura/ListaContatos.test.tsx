import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter } from 'react-router-dom';
import type { ContatoLocal } from '@/lib/offline/tipos';
import { ListaContatos } from './ListaContatos';

const local = vi.hoisted(() => ({
  itens: [] as ContatoLocal[],
  gravar: vi.fn(),
}));
const time = vi.hoisted(() => ({
  equipe: [] as { id: string; nome: string; papel?: string }[],
}));
vi.mock('../comercial/api', () => ({
  useEquipe: () => ({ equipe: time.equipe, erro: '', carregando: false }),
}));
vi.mock('@/lib/offline/fila', () => ({
  lerTodos: vi.fn(async () => local.itens),
  observarFila: vi.fn(() => () => undefined),
  salvarCampo: local.gravar,
  garantirContato: local.gravar,
}));

function contato(idLocal = 'local-pendente', idServidor?: string): ContatoLocal {
  return {
    idLocal,
    idServidor,
    campos: { nome: 'Edição neste aparelho' },
    modo: 'manual',
    estado: 'local',
    tentativas: 0,
    atualizadoEm: 10,
  };
}

function resposta(dados: unknown[], proximoCursor: string | null = null, status = 200) {
  return {
    ok: status === 200,
    status,
    json: async () => ({
      dados,
      proximoCursor,
      erros: status === 200 ? [] : [{ mensagem: 'Acesso expirou.' }],
    }),
  };
}

function pendente<T>() {
  let resolver!: (valor: T) => void;
  const promessa = new Promise<T>((resolve) => {
    resolver = resolve;
  });
  return { promessa, resolver };
}

function abrir() {
  return render(
    <MemoryRouter>
      <ListaContatos />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  time.equipe = [];
  local.itens = [];
  localStorage.clear();
  localStorage.setItem('captura7.token', 'sessao-a');
  localStorage.setItem(
    'captura7.perfil',
    JSON.stringify({ id: 'usuario-a', nome: 'QA', papel: 'admin' }),
  );
  vi.stubGlobal('navigator', { onLine: true });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('contatos deste aparelho e do CRM', () => {
  it('mudar apenas query preserva contatos carregados sem refazer a consulta', async () => {
    const fetchMock = vi.fn(async () => resposta([{ _id: 'fixo', nome: 'Contato já carregado' }]));
    vi.stubGlobal('fetch', fetchMock);
    render(
      <MemoryRouter initialEntries={['/contatos']}>
        <Link to="/contatos?origem=menu">Mudar query</Link>
        <ListaContatos />
      </MemoryRouter>,
    );
    await screen.findByRole('link', { name: 'Contato já carregado' });
    fireEvent.click(screen.getByRole('link', { name: 'Mudar query' }));
    expect(screen.getByRole('link', { name: 'Contato já carregado' })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('mostra remotos sem IndexedDB local, com link e estado remoto, sem gravar na fila', async () => {
    const fetchMock = vi.fn(async () =>
      resposta([{ _id: 'remoto-1', nome: 'Lead de outro aparelho', status: 'capturado' }]),
    );
    vi.stubGlobal('fetch', fetchMock);
    abrir();
    expect(
      (await screen.findByRole('link', { name: 'Lead de outro aparelho' })).getAttribute('href'),
    ).toBe('/lead/remoto-1');
    expect(screen.getByText('Salvo no CRM · capturado')).toBeTruthy();
    expect(screen.queryByText('Nenhum contato encontrado.')).toBeNull();
    expect(local.gravar).not.toHaveBeenCalled();
    expect(local.itens).toHaveLength(0);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/v1/contatos?limite=20'),
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: 'Bearer sessao-a' }),
      }),
    );
  });

  it('deduplica idServidor e idLocal preservando edição pendente, link local e estado local', async () => {
    const pendencia = contato('local-a', 'servidor-a');
    local.itens = [
      {
        ...pendencia,
        campos: { nome: 'Versão sincronizada antiga' },
        estado: 'sincronizado',
        atualizadoEm: 20,
      },
      pendencia,
      { ...contato('local-b'), campos: { nome: 'Outro rascunho local' } },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        resposta([
          { _id: 'servidor-a', nome: 'Versão do servidor' },
          { _id: 'servidor-b', idLocal: 'local-b', nome: 'Outro remoto duplicado' },
        ]),
      ),
    );
    abrir();
    const link = await screen.findByRole('link', { name: 'Edição neste aparelho' });
    await waitFor(() => expect(screen.queryByText('Carregando contatos do CRM…')).toBeNull());
    expect(link.getAttribute('href')).toBe('/contatos/local-a');
    expect(screen.getAllByText('Salvo neste aparelho')).toHaveLength(2);
    expect(screen.queryByText('Versão sincronizada antiga')).toBeNull();
    expect(screen.queryByText('Versão do servidor')).toBeNull();
    expect(screen.queryByText('Outro remoto duplicado')).toBeNull();
    expect(local.itens[1]).toEqual(pendencia);
    expect(local.gravar).not.toHaveBeenCalled();
  });

  it('pagina com cursor, bloqueia clique duplo e não repete contato entre páginas', async () => {
    const segunda = pendente<ReturnType<typeof resposta>>();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(resposta([{ _id: 'a', nome: 'Primeiro' }], 'cursor-2'))
      .mockReturnValueOnce(segunda.promessa);
    vi.stubGlobal('fetch', fetchMock);
    abrir();
    const mais = await screen.findByRole('button', { name: 'Carregar mais contatos' });
    fireEvent.click(mais);
    fireEvent.click(mais);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain('cursor=cursor-2');
    await act(async () =>
      segunda.resolver(
        resposta([
          { _id: 'a', nome: 'Primeiro' },
          { _id: 'b', nome: 'Segundo' },
        ]),
      ),
    );
    expect(await screen.findByRole('link', { name: 'Segundo' })).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'Primeiro' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Carregar mais contatos' })).toBeNull();
  });

  it('erro de rede permite retry sem apagar contato local', async () => {
    local.itens = [contato()];
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(resposta([{ _id: 'novo', nome: 'Após reconectar' }]));
    vi.stubGlobal('fetch', fetchMock);
    abrir();
    expect((await screen.findByRole('alert')).textContent).toContain('Confira sua conexão');
    expect(screen.getByRole('link', { name: 'Edição neste aparelho' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar contatos do CRM' }));
    expect(await screen.findByRole('link', { name: 'Após reconectar' })).toBeTruthy();
    expect(screen.getByText('Salvo neste aparelho')).toBeTruthy();
  });

  it('offline mantém locais e reconexão consulta remotos', async () => {
    local.itens = [contato()];
    vi.stubGlobal('navigator', { onLine: false });
    const fetchMock = vi.fn(async () => resposta([{ _id: 'online', nome: 'Lead online' }]));
    vi.stubGlobal('fetch', fetchMock);
    abrir();
    expect((await screen.findByRole('alert')).textContent).toContain('Sem conexão');
    expect(screen.getByText('Salvo neste aparelho')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    vi.stubGlobal('navigator', { onLine: true });
    act(() => window.dispatchEvent(new Event('online')));
    expect(await screen.findByRole('link', { name: 'Lead online' })).toBeTruthy();
  });

  it.each([401, 403])('HTTP%s apaga remotos anteriores sem apagar edição local', async (status) => {
    local.itens = [contato()];
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(resposta([{ _id: 'privado', nome: 'Remoto anterior' }]))
        .mockResolvedValueOnce(resposta([], null, status)),
    );
    abrir();
    await screen.findByRole('link', { name: 'Remoto anterior' });
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar contatos do CRM' }));
    await screen.findByText('Acesso expirou.');
    expect(screen.queryByRole('link', { name: 'Remoto anterior' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Edição neste aparelho' })).toBeTruthy();
  });

  it.each(['tela-viva-sessao', 'storage'])(
    'logout por evento%s esconde remotos imediatamente',
    async (evento) => {
      local.itens = [contato()];
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => resposta([{ _id: 'privado', nome: 'Remoto anterior' }])),
      );
      abrir();
      await screen.findByRole('link', { name: 'Remoto anterior' });
      act(() => {
        localStorage.removeItem('captura7.token');
        window.dispatchEvent(new Event(evento));
      });
      expect(screen.queryByRole('link', { name: 'Remoto anterior' })).toBeNull();
      expect(screen.getByRole('link', { name: 'Edição neste aparelho' })).toBeTruthy();
      expect(
        screen.getByRole('link', { name: 'Entre para consultar os contatos do CRM.' }),
      ).toBeTruthy();
    },
  );

  it('troca de sessão ignora resposta antiga mesmo quando fetch ignora abort', async () => {
    const antiga = pendente<ReturnType<typeof resposta>>();
    const nova = pendente<ReturnType<typeof resposta>>();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(resposta([{ _id: 'a', nome: 'Dado do usuário A' }]))
      .mockReturnValueOnce(antiga.promessa)
      .mockReturnValueOnce(nova.promessa);
    vi.stubGlobal('fetch', fetchMock);
    abrir();
    await screen.findByRole('link', { name: 'Dado do usuário A' });
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar contatos do CRM' }));
    act(() => {
      localStorage.setItem('captura7.token', 'sessao-b');
      window.dispatchEvent(new Event('tela-viva-sessao'));
    });
    expect(screen.queryByRole('link', { name: 'Dado do usuário A' })).toBeNull();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const signal = fetchMock.mock.calls[1][1].signal as AbortSignal;
    expect(signal.aborted).toBe(true);
    await act(async () =>
      antiga.resolver(resposta([{ _id: 'vazamento', nome: 'Resposta antiga privada' }])),
    );
    expect(screen.queryByRole('link', { name: 'Resposta antiga privada' })).toBeNull();
    await act(async () => nova.resolver(resposta([{ _id: 'b', nome: 'Dado do usuário B' }])));
    expect(await screen.findByRole('link', { name: 'Dado do usuário B' })).toBeTruthy();
    expect(local.gravar).not.toHaveBeenCalled();
  });

  it('gestão filtra sem responsável, seleciona e atribui a um vendedor', async () => {
    time.equipe = [{ id: 'vend-1', nome: 'Paula Vendas', papel: 'vendedor' }];
    const fetchMock = vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
      if (String(entrada).includes('/atribuir'))
        return {
          ok: true,
          status: 201,
          json: async () => ({ dados: { atribuidos: 1, semMudanca: 0, naoEncontrados: 0 } }),
        };
      void init;
      return resposta([{ _id: 'lead-sem-dono', nome: 'Lead da Feira' }]);
    });
    vi.stubGlobal('fetch', fetchMock);
    abrir();
    await screen.findByRole('link', { name: 'Lead da Feira' });
    expect(screen.getByText(/Responsável:\s*ninguém ainda/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Responsável'), { target: { value: 'sem' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('responsavel=sem'))).toBe(true),
    );
    fireEvent.click(await screen.findByLabelText('Selecionar Lead da Feira'));
    fireEvent.change(screen.getByLabelText('Passar para'), { target: { value: 'vend-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Atribuir' }));
    await screen.findByText(/1 contato\(s\) agora com Paula Vendas/);
    const post = fetchMock.mock.calls.find((c) => String(c[0]).includes('/atribuir'));
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({
      ids: ['lead-sem-dono'],
      responsavelId: 'vend-1',
    });
  });

  it('vendedor não vê filtro de responsável nem seleção', async () => {
    localStorage.setItem(
      'captura7.perfil',
      JSON.stringify({ id: 'usuario-a', nome: 'QA', papel: 'vendedor' }),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => resposta([{ _id: 'meu', nome: 'Meu lead' }])),
    );
    abrir();
    await screen.findByRole('link', { name: 'Meu lead' });
    expect(screen.queryByLabelText('Responsável')).toBeNull();
    expect(screen.queryByLabelText('Selecionar Meu lead')).toBeNull();
  });
});
