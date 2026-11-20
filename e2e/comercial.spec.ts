import { expect, test, type Page } from '@playwright/test';

const API = 'http://127.0.0.1:3101';
const ID = '507f1f77bcf86cd799439088';
const headers = { 'x-papel-teste': 'admin', 'x-usuario-id': ID, 'x-autor-nome': 'QA comercial' };

async function salvar(page: Page, secao: string) {
  const resposta = page.waitForResponse(
    (r) => r.url().endsWith(`/v1/comercial/${secao}`) && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Salvar na carteira', exact: true }).click();
  const confirmado = await resposta;
  expect(confirmado.status()).toBe(201);
  const { registro } = await confirmado.json();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  return registro;
}

test('representante organiza conta, visita, oportunidade e proposta sem dados de produção', async ({
  page,
  request,
}) => {
  await page.addInitScript(
    ({ id }) => {
      localStorage.setItem(
        'captura7.sessao',
        JSON.stringify({ id, papel: 'admin', nome: 'QA comercial' }),
      );
      localStorage.setItem(
        'captura7.perfil',
        JSON.stringify({ id, papel: 'admin', nome: 'QA comercial' }),
      );
    },
    { id: ID },
  );
  const produtoResposta = await request.post(`${API}/v1/comercial/produtos`, {
    headers,
    data: { nome: 'Produto QA isolado', categoria: 'cosmetico', precoCentavos: 1990 },
  });
  expect(produtoResposta.status()).toBe(201);
  const produto = (await produtoResposta.json()).registro;

  await page.goto('/carteira?novo=1');
  await page.getByLabel('Nome da instituição', { exact: true }).fill('Estúdio QA isolado');
  await page
    .getByRole('combobox', { name: 'Segmento', exact: true })
    .selectOption('estudio_tatuagem');
  await page.getByLabel('Cidade', { exact: true }).fill('São Bernardo do Campo');
  const conta = await salvar(page, 'contas');
  await expect(page.getByRole('link', { name: 'Estúdio QA isolado', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.goto(`/agenda?novo=1&contaId=${conta._id}`);
  await page.getByLabel('Título da visita ou atividade').fill('Visita QA isolada');
  await page.getByLabel('Data e horário', { exact: true }).fill('2026-11-20T10:00');
  const visita = await salvar(page, 'atividades');
  await page.getByRole('button', { name: 'Editar Visita QA isolada', exact: true }).click();
  await page.getByRole('combobox', { name: 'Situação', exact: true }).selectOption('concluida');
  await page.getByLabel('Resultado da visita / atividade').fill('Portfólio apresentado');
  const atualizada = page.waitForResponse(
    (r) => r.url().endsWith(`/atividades/${visita._id}`) && r.request().method() === 'PATCH',
  );
  await page.getByRole('button', { name: 'Salvar na carteira', exact: true }).click();
  expect((await atualizada).ok()).toBe(true);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const visitaGravada = await request.get(`${API}/v1/comercial/atividades/${visita._id}`, {
    headers,
  });
  expect((await visitaGravada.json()).registro).toMatchObject({
    status: 'concluida',
    resultado: 'Portfólio apresentado',
    contaId: conta._id,
  });

  await page.goto(`/oportunidades?novo=1&contaId=${conta._id}`);
  await page.getByLabel('Nome da oportunidade').fill('Reposição QA isolada');
  await page.getByLabel('Valor estimado (R$)').fill('250');
  const oportunidade = await salvar(page, 'oportunidades');
  const mudanca = page.waitForResponse(
    (r) =>
      r.url().endsWith(`/oportunidades/${oportunidade._id}`) && r.request().method() === 'PATCH',
  );
  await page.getByLabel('Etapa de Reposição QA isolada').selectOption('proposta');
  expect((await mudanca).ok()).toBe(true);

  await page.goto(`/propostas?novo=1&contaId=${conta._id}`);
  await page.getByLabel('Título da proposta').fill('Proposta QA isolada');
  await page.getByRole('button', { name: 'Adicionar item', exact: true }).click();
  await page.getByRole('combobox', { name: 'Produto do catálogo' }).selectOption(produto._id);
  await page.getByLabel('Quantidade', { exact: true }).fill('2');
  await page.getByLabel('Desconto (%)', { exact: true }).fill('10');
  const proposta = await salvar(page, 'propostas');
  expect(proposta.totalCentavos).toBe(3582);
  await page.getByRole('button', { name: 'Abrir Proposta QA isolada', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('54.765.439/0001-34');
  await page.evaluate(() => {
    window.print = () => {
      document.body.dataset.impressaoSolicitada = 'sim';
    };
  });
  await page.getByRole('button', { name: 'Imprimir proposta', exact: true }).click();
  await expect(page.locator('body')).toHaveAttribute('data-impressao-solicitada', 'sim');
  await expect(page.locator('.tv-print-sheet')).toContainText('JSETTE7');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.tv-print-sheet')).toBeVisible();
  await expect(page.locator('.tv-print-sheet')).toContainText('35,82');
});

test('menu móvel fechado não recebe foco e a captura mantém acesso em dois toques', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('#navegacao-principal')).toHaveAttribute('inert', '');
  await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
  await expect(page.locator('#navegacao-principal')).not.toHaveAttribute('inert', '');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Abrir menu', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Digitar', exact: true }).click();
  await expect(page.getByLabel('Nome', { exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
