import { expect, test } from '@playwright/test';

const API = 'http://127.0.0.1:3101';
const ID = '507f1f77bcf86cd799439071';
const headers = {
  'x-papel-teste': 'gestor',
  'x-usuario-id': ID,
  'x-autor-nome': 'Gestão QA campanhas',
};

for (const viewport of [
  { width: 1280, height: 900, nome: 'desktop' },
  { width: 360, height: 800, nome: 'mobile' },
]) {
  test(`campanha ${viewport.nome}: rascunho real isolado, seleção explícita e envio OFF`, async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.addInitScript(
      ({ id }) => {
        localStorage.setItem(
          'captura7.sessao',
          JSON.stringify({ id, papel: 'gestor', nome: 'Gestão QA campanhas' }),
        );
        localStorage.setItem(
          'captura7.perfil',
          JSON.stringify({ id, papel: 'gestor', nome: 'Gestão QA campanhas' }),
        );
      },
      { id: ID },
    );
    const config = await request.get(`${API}/v1/campanhas/configuracao`, { headers });
    expect(config.status()).toBe(200);
    expect((await config.json()).registro.envioAtivo).toBe(false);
    const nome = `Contato campanha ${viewport.nome} ${Date.now()}`;
    const lead = await request.post(`${API}/v1/contatos`, {
      headers,
      data: {
        nome,
        origem: { modo: 'manual' },
        telefones: [{ e164: '+5511999990042', bruto: '(11) 99999-0042' }],
      },
    });
    expect(lead.status()).toBe(201);
    await page.goto('/campanhas');
    await expect(page.getByRole('heading', { name: 'Campanhas', exact: true })).toBeVisible();
    await expect(page.getByText('Envio desativado no ambiente')).toBeVisible();
    await page.getByRole('button', { name: 'Nova campanha' }).click();
    await expect(page.getByLabel('Mensagem para revisão')).toHaveValue(/K-dAS5cQBQQ/);
    await page.getByLabel('Título da campanha').fill(`Pós feira QA ${viewport.nome}`);
    const salvo = page.waitForResponse(
      (r) => r.url().endsWith('/v1/campanhas') && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Salvar rascunho' }).click();
    expect((await salvo).status()).toBe(201);
    await expect(page).toHaveURL(/\/campanhas\/[a-f\d]{24}$/);
    await expect(page.getByText('Versão 1 salva no servidor.')).toBeVisible();
    await page.getByLabel('Buscar contato por nome').fill(nome);
    await page.getByRole('button', { name: 'Buscar contatos' }).click();
    // O CRM normaliza o nome (iniciais maiúsculas) ao gravar o contato.
    await expect(page.getByLabel(new RegExp(`^Selecionar ${nome}$`, 'i'))).toBeDisabled();
    await expect(
      page.getByText('Sem autorização comercial documentada', { exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Consultar prévia salva' }).click();
    await expect(
      page.getByText(
        'Selecione um modelo e confira a correspondência da mensagem antes de preparar.',
      ),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Preparar público' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Consultar modelos na Meta' })).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('heading', { name: 'Campanhas', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/campanhas-${viewport.nome}.png`, fullPage: true });
    const campanhaId = new URL(page.url()).pathname.split('/').at(-1);
    const leitura = await request.get(`${API}/v1/campanhas/${campanhaId}`, { headers });
    expect((await leitura.json()).registro).toMatchObject({
      estado: 'rascunho',
      contatosIds: [],
      template: null,
    });
    const negado = await request.get(`${API}/v1/campanhas`, {
      headers: { ...headers, 'x-papel-teste': 'vendedor' },
    });
    expect(negado.status()).toBe(403);
  });
}
