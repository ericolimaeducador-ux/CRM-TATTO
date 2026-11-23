import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Menu } from '../captura/Menu';
import { PaginaCampanhas } from './PaginaCampanhas';
import {
  CADENCIA_INICIAL,
  MENSAGEM_CAMPANHA,
  type Campanha,
  type ConfigCampanhas,
} from './campanhas-api';

vi.mock('@/lib/offline/sessao', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/offline/sessao')>()),
  headersDeTesteNoCliente: () => false,
}));
const ID = '507f1f77bcf86cd799439091';
const C1 = '507f1f77bcf86cd799439092';
const C2 = '507f1f77bcf86cd799439093';
const C3 = '507f1f77bcf86cd799439094';
function resposta(corpo: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => corpo } as Response;
}
function montar(rota = '/campanhas') {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <Menu />
      <Routes>
        <Route path="/campanhas" element={<PaginaCampanhas />} />
        <Route path="/campanhas/:id" element={<PaginaCampanhas />} />
      </Routes>
    </MemoryRouter>,
  );
}
function base(): Campanha {
  return {
    _id: ID,
    titulo: 'Pós Tattoo Week QA',
    mensagem: MENSAGEM_CAMPANHA,
    contatosIds: [],
    template: null,
    cadencia: { ...CADENCIA_INICIAL },
    estado: 'rascunho',
    versao: 1,
    criadoEm: '2026-11-23T13:00:00Z',
    alteradoEm: '2026-11-23T13:00:00Z',
  };
}
function entrar(papel = 'gestor') {
  localStorage.setItem('captura7.token', 'token-local-qa');
  localStorage.setItem('captura7.perfil', JSON.stringify({ id: ID, nome: 'Gestão QA', papel }));
}

describe('Campanhas — preparação, segurança e estados honestos', () => {
  let campanha: Campanha;
  let config: ConfigCampanhas;
  let falharSave: number;
  let respondeu: boolean;
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    localStorage.clear();
    entrar();
    campanha = base();
    falharSave = 0;
    respondeu = false;
    config = {
      envioAtivo: false,
      configuracaoCompleta: false,
      faltantes: ['WHATSAPP_WABA_ID', 'WHATSAPP_ACCESS_TOKEN'],
      limitePublico: 2000,
    };
    fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), 'http://localhost');
      const caminho = url.pathname;
      const metodo = init?.method ?? 'GET';
      const corpo = init?.body ? JSON.parse(String(init.body)) : {};
      if (caminho.endsWith('/configuracao')) return resposta({ registro: config });
      if (caminho.endsWith('/templates'))
        return resposta({
          registros: [
            {
              id: '12345',
              nome: 'pos_feira_qa',
              idioma: 'pt_BR',
              corpo: MENSAGEM_CAMPANHA,
              status: 'APPROVED',
              categoria: 'MARKETING',
            },
          ],
        });
      if (caminho.endsWith('/candidatos'))
        return resposta({
          registros: [
            {
              id: C1,
              nome: 'Marina autorizada',
              telefoneMascarado: '+55 ••••• 0042',
              status: 'cliente',
              origem: 'manual',
              tags: ['feira'],
              elegivel: true,
              motivo: '',
            },
            {
              id: C2,
              nome: 'Contato sem autorização',
              telefoneMascarado: '',
              status: 'capturado',
              origem: 'manual',
              tags: [],
              elegivel: false,
              motivo: 'sem_autorizacao_documentada',
            },
            {
              id: C3,
              nome: 'Marina cadastro repetido',
              telefoneMascarado: '+55 ••••• 0042',
              status: 'cliente',
              origem: 'manual',
              tags: ['feira'],
              elegivel: true,
              motivo: '',
            },
          ],
          total: 3,
          pagina: 1,
          limite: 30,
        });
      if (caminho.endsWith('/resultados'))
        return resposta({
          registro: {
            resumo: respondeu ? { aceito: 1 } : {},
            respondidos: respondeu ? 1 : 0,
            registros: respondeu
              ? [
                  {
                    _id: C1,
                    contatoId: C1,
                    telefoneMascarado: '+55 ••••• 0042',
                    estado: 'aceito',
                    motivo: '',
                    tentativas: 1,
                    respondeuEm: '2026-11-23T13:10:00Z',
                  },
                ]
              : [],
            total: respondeu ? 1 : 0,
            pagina: 1,
            limite: 30,
            diario: respondeu ? 1 : 0,
            proximaSaidaEm: null,
            aviso:
              'Aceito pela API não significa entregue. Incertos não são reenviados automaticamente.',
          },
        });
      if (caminho.endsWith('/auditoria')) return resposta({ registro: { eventos: [] } });
      if (caminho.endsWith('/previa'))
        return resposta({
          registro: {
            selecionados: campanha.contatosIds.length,
            elegiveis: campanha.contatosIds.length ? 1 : 0,
            excluidos: Math.max(0, campanha.contatosIds.length - 1),
            duplicados: Math.max(0, campanha.contatosIds.length - 1),
            destinatarios: campanha.contatosIds.map((id, i) => ({
              contatoId: id,
              nome: i ? 'Marina cadastro repetido' : 'Marina autorizada',
              telefoneMascarado: '+55 ••••• 0042',
              elegivel: i === 0,
              motivo: i ? 'telefone_duplicado' : '',
            })),
            mensagem: campanha.mensagem,
            templateCompativel: !!campanha.template,
          },
        });
      if (caminho.endsWith('/preparar')) {
        campanha = { ...campanha, estado: 'preparada', versao: campanha.versao + 2 };
        return resposta({ registro: campanha }, 201);
      }
      for (const acao of ['iniciar', 'retomar', 'pausar', 'cancelar'])
        if (caminho.endsWith(`/${acao}`)) {
          campanha = {
            ...campanha,
            estado:
              acao === 'cancelar' ? 'cancelada' : acao === 'pausar' ? 'pausada' : 'em_andamento',
            versao: campanha.versao + 1,
          };
          return resposta({ registro: campanha }, 201);
        }
      if (metodo === 'POST' || metodo === 'PATCH') {
        if (falharSave)
          return resposta(
            { erros: [{ mensagem: 'A campanha foi alterada por outra pessoa.' }] },
            falharSave,
          );
        campanha = {
          ...campanha,
          ...corpo,
          _id: ID,
          versao: metodo === 'POST' ? 1 : campanha.versao + 1,
        };
        return resposta({ registro: campanha }, 201);
      }
      if (caminho.endsWith(`/${ID}`)) return resposta({ registro: campanha });
      return resposta({ registros: [], total: 0, pagina: 1, limite: 30 });
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('salva rascunho com envio OFF, sem público nem modelo e sem consultar a Meta', async () => {
    montar();
    await screen.findByText('Envio desativado no ambiente');
    fireEvent.click(screen.getByRole('button', { name: 'Nova campanha' }));
    expect((screen.getByLabelText('Mensagem para revisão') as HTMLTextAreaElement).value).toContain(
      'K-dAS5cQBQQ',
    );
    fireEvent.change(screen.getByLabelText('Título da campanha'), {
      target: { value: 'Rascunho incompleto' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await screen.findByText('Versão 1 salva no servidor.');
    const escrita = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(String(escrita?.[1]?.body))).toMatchObject({
      titulo: 'Rascunho incompleto',
      contatosIds: [],
      template: null,
    });
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/templates'))).toBe(false);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/iniciar'))).toBe(false);
  });
  it.each(['vendedor', 'auditor'])('não mostra menu e não consulta API para %s', async (papel) => {
    entrar(papel);
    montar();
    expect(screen.getByText('Acesso da gestão')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Campanhas' })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('seleção é individual, inelegível não pode ser marcado e prévia conta telefone repetido', async () => {
    montar(`/campanhas/${ID}`);
    await screen.findByLabelText('Selecionar Marina autorizada');
    expect(
      (screen.getByLabelText('Selecionar Contato sem autorização') as HTMLInputElement).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByLabelText('Selecionar Marina autorizada'));
    fireEvent.click(screen.getByLabelText('Selecionar Marina cadastro repetido'));
    expect(
      (screen.getByRole('button', { name: 'Consultar prévia salva' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await screen.findByText('Versão 2 salva no servidor.');
    fireEvent.click(screen.getByRole('button', { name: 'Consultar prévia salva' }));
    await screen.findByRole('region', { name: 'Resumo da prévia' }).catch(() => undefined);
    await screen.findByText('Telefone repetido nesta campanha');
    expect(campanha.contatosIds).toEqual([C1, C3]);
    expect(
      fetchMock.mock.calls.some(([url]) => /consentimento|autorizacao/.test(String(url))),
    ).toBe(false);
  });
  it('envia filtros apenas ao buscar e preserva seleção fora da página', async () => {
    montar(`/campanhas/${ID}`);
    await screen.findByLabelText('Selecionar Marina autorizada');
    fireEvent.click(screen.getByLabelText('Selecionar Marina autorizada'));
    const antes = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes('/candidatos'),
    ).length;
    fireEvent.change(screen.getByLabelText('Buscar contato por nome'), {
      target: { value: 'Marina' },
    });
    fireEvent.change(screen.getByLabelText('Tag do contato'), { target: { value: 'feira' } });
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).includes('/candidatos')),
    ).toHaveLength(antes);
    fireEvent.click(screen.getByRole('button', { name: 'Buscar contatos' }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url]) => String(url).includes('q=Marina') && String(url).includes('tag=feira'),
        ),
      ).toBe(true),
    );
    expect(
      (screen.getByLabelText('Selecionar Marina autorizada') as HTMLInputElement).checked,
    ).toBe(true);
  });
  it('permite escolher somente modelo consultado, exige salvar antes de preparar', async () => {
    config = { ...config, configuracaoCompleta: true, faltantes: [] };
    campanha.contatosIds = [C1];
    montar(`/campanhas/${ID}`);
    await screen.findByLabelText('Título da campanha');
    fireEvent.click(screen.getByRole('button', { name: 'Consultar modelos na Meta' }));
    await screen.findByRole('option', { name: 'pos_feira_qa · pt_BR' });
    fireEvent.change(screen.getByLabelText('Modelo de marketing'), {
      target: { value: '12345:pt_BR' },
    });
    expect(
      (screen.getByRole('button', { name: 'Preparar público' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await screen.findByText('Versão 2 salva no servidor.');
    fireEvent.click(screen.getByRole('button', { name: 'Consultar prévia salva' }));
    await screen.findByText('Elegível nesta revisão');
    fireEvent.click(screen.getByRole('button', { name: 'Preparar público' }));
    await screen.findByText('Versão 4 salva no servidor.');
    expect(
      (screen.getByRole('button', { name: 'Revisar início dos envios' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/iniciar'))).toBe(false);
  });
  it('mantém campos quando versão conflita e oferece comparação sem sobrescrever', async () => {
    montar(`/campanhas/${ID}`);
    await screen.findByLabelText('Título da campanha');
    falharSave = 409;
    fireEvent.change(screen.getByLabelText('Título da campanha'), {
      target: { value: 'Alteração local preservada' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await screen.findByText(
      'Seus campos foram preservados. Consulte a versão atual e compare antes de continuar.',
    );
    expect((screen.getByLabelText('Título da campanha') as HTMLInputElement).value).toBe(
      'Alteração local preservada',
    );
    campanha = { ...campanha, versao: 3, titulo: 'Título alterado no servidor' };
    fireEvent.click(screen.getByRole('button', { name: 'Comparar versão atual' }));
    await screen.findByText('Versão atual no servidor: 3');
    expect((screen.getByLabelText('Título da campanha') as HTMLInputElement).value).toBe(
      'Alteração local preservada',
    );
  });
  it('início requer confirmação explícita e resultado distingue resposta de entrega', async () => {
    config = { ...config, envioAtivo: true, configuracaoCompleta: true, faltantes: [] };
    campanha.estado = 'preparada';
    campanha.contatosIds = [C1];
    campanha.template = {
      id: '12345',
      nome: 'pos_feira_qa',
      idioma: 'pt_BR',
      corpo: MENSAGEM_CAMPANHA,
    };
    respondeu = true;
    montar(`/campanhas/${ID}`);
    await screen.findByRole('button', { name: 'Revisar início dos envios' });
    await screen.findByText(/Resposta recebida em/);
    expect(screen.getAllByText('Aceito pela Meta').length).toBeGreaterThan(0);
    expect(screen.queryByText('Entregue')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Revisar início dos envios' }));
    await screen.findByRole('dialog');
    expect(
      (screen.getByRole('button', { name: 'Confirmar início' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(
      screen.getByLabelText('Revisei público, modelo e condições e confirmo o início dos envios.'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar início' }));
    await screen.findByRole('button', { name: 'Pausar campanha' });
    const envio = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/iniciar'));
    expect(JSON.parse(String(envio?.[1]?.body))).toMatchObject({ versao: 1, confirmar: true });
  });
  it('preparação interrompida pode ser retomada ou cancelada', async () => {
    campanha.estado = 'preparando';
    campanha.contatosIds = [C1];
    campanha.template = {
      id: '12345',
      nome: 'pos_feira_qa',
      idioma: 'pt_BR',
      corpo: MENSAGEM_CAMPANHA,
    };
    montar(`/campanhas/${ID}`);
    await screen.findByText('Em preparação');
    expect(screen.getByRole('button', { name: 'Retomar preparação' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancelar campanha' })).toBeTruthy();
  });
});
