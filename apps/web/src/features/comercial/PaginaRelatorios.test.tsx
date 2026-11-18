import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PaginaRelatorios } from './PaginaRelatorios';

vi.mock('@/lib/offline/sessao', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/offline/sessao')>()),
  headersDeTesteNoCliente: () => false,
}));

const REPRESENTANTE = '507f1f77bcf86cd799439081';
function resposta(corpo: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => corpo } as Response;
}
function relatorio(url: string, total = 0) {
  const parametros = new URL(url, 'http://localhost').searchParams;
  return {
    periodo: {
      de: parametros.get('de'),
      ate: parametros.get('ate'),
      ...(parametros.get('representanteId')
        ? { representanteId: parametros.get('representanteId') }
        : {}),
    },
    baseJanela: { atividades: 'data marcada da atividade', demais: 'data de criação do registro' },
    atividades: {
      total,
      porTipo: total ? [{ tipo: 'visita', quantidade: total }] : [],
      porStatus: [],
    },
    oportunidades: { total: 0, pipelineCentavos: 0, porEtapa: [] },
    propostas: { total: 0, totalCentavos: 0, porStatus: [] },
    treinamentos: { quantidade: 0 },
    participantes: { inscricoes: 0, confirmados: 0, presentes: 0 },
  };
}
function entrar(papel = 'vendedor') {
  localStorage.setItem('captura7.token', 'token-qa');
  localStorage.setItem('captura7.perfil', JSON.stringify({ id: REPRESENTANTE, nome: 'QA', papel }));
}
function montar() {
  return render(
    <MemoryRouter>
      <PaginaRelatorios />
    </MemoryRouter>,
  );
}

describe('TV-15 — relatórios comerciais', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('consulta a carteira do representante e só envia novas datas ao confirmar o filtro', async () => {
    entrar();
    const fetchMock = vi.fn(async (url: string) => resposta(relatorio(String(url), 3)));
    vi.stubGlobal('fetch', fetchMock);
    montar();
    await screen.findByText('Sua carteira');
    expect(screen.queryByLabelText('Representante / responsável pela carteira')).toBeNull();
    const antes = fetchMock.mock.calls.length;
    fireEvent.change(screen.getByLabelText('Data inicial do relatório'), {
      target: { value: '2026-11-01' },
    });
    fireEvent.change(screen.getByLabelText('Data final do relatório'), {
      target: { value: '2026-11-16' },
    });
    expect(fetchMock).toHaveBeenCalledTimes(antes);
    fireEvent.click(screen.getByRole('button', { name: 'Consultar relatório' }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url]) => String(url).includes('de=2026-11-01&ate=2026-11-16')),
      ).toBe(true),
    );
    expect(fetchMock.mock.calls.every(([url]) => !String(url).includes('representanteId'))).toBe(
      true,
    );
    expect(fetchMock.mock.calls.every(([url]) => !String(url).includes('/usuarios/equipe'))).toBe(
      true,
    );
    expect(screen.queryByRole('button', { name: /exportar/i })).toBeNull();
  });

  it('gestão usa o diretório mínimo para filtrar uma carteira', async () => {
    entrar('gestor');
    const fetchMock = vi.fn(async (url: string) =>
      String(url).includes('/usuarios/equipe')
        ? resposta({
            dados: [
              { id: REPRESENTANTE, nome: 'Representante QA', papel: 'vendedor', ativo: true },
            ],
          })
        : resposta(relatorio(String(url), 1)),
    );
    vi.stubGlobal('fetch', fetchMock);
    montar();
    await screen.findByRole('option', { name: 'Representante QA · Representante' });
    await screen.findByText('Carteiras consolidadas');
    fireEvent.change(screen.getByLabelText('Representante / responsável pela carteira'), {
      target: { value: REPRESENTANTE },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar relatório' }));
    await screen.findByText('Carteira selecionada');
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).includes(`representanteId=${REPRESENTANTE}`),
      ),
    ).toBe(true);
  });

  it('recusa período invertido ou maior que 366 dias sem buscar dados', async () => {
    entrar();
    const fetchMock = vi.fn(async (url: string) => resposta(relatorio(String(url))));
    vi.stubGlobal('fetch', fetchMock);
    montar();
    await screen.findByText('Nenhum registro nesta janela de consulta.');
    const antes = fetchMock.mock.calls.length;
    fireEvent.change(screen.getByLabelText('Data inicial do relatório'), {
      target: { value: '2026-11-20' },
    });
    fireEvent.change(screen.getByLabelText('Data final do relatório'), {
      target: { value: '2026-11-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar relatório' }));
    expect(screen.getByRole('alert').textContent).toContain('anterior ou igual');
    fireEvent.change(screen.getByLabelText('Data inicial do relatório'), {
      target: { value: '2024-01-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar relatório' }));
    expect(screen.getByRole('alert').textContent).toContain('até 366 dias');
    expect(fetchMock).toHaveBeenCalledTimes(antes);
  });

  it('mostra erro de rede e recupera os totais vazios ao repetir', async () => {
    entrar('auditor');
    let falhar = true;
    const fetchMock = vi.fn(async (url: string) => {
      if (falhar) throw new Error('rede');
      return resposta(relatorio(String(url)));
    });
    vi.stubGlobal('fetch', fetchMock);
    montar();
    await screen.findByRole('alert');
    expect(screen.queryByText('Nenhum registro nesta janela de consulta.')).toBeNull();
    expect(screen.queryByLabelText('Representante / responsável pela carteira')).toBeNull();
    falhar = false;
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await screen.findByText('Nenhum registro nesta janela de consulta.');
    expect(screen.getByText('Visão consolidada de auditoria')).toBeTruthy();
  });

  it('sem sessão mostra entrada e não consulta a API nem inventa totais', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    montar();
    expect(screen.getByRole('link', { name: 'Entrar no Tela Viva' })).toBeTruthy();
    expect(screen.queryByText('Atividades agendadas')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
