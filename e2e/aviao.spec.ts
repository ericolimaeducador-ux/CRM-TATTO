import { expect, test, type Page } from '@playwright/test';

test('lead em avião reabre e chega ao servidor sem duplicata', async ({
  page,
  context,
  request,
}) => {
  await abrirControlado(page);
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Digitar' }).click();
  await page.getByLabel('Nome').fill('Lead Avião');
  await expect(page.getByText('Salvo neste aparelho').first()).toBeVisible();
  await expect(page.getByText('Sincronizado')).toHaveCount(0);
  await expect(page.getByText(/^Salvo$/)).toHaveCount(0);
  await expect(page.getByText(/^Salvo!$/)).toHaveCount(0);

  const url = page.url();
  await page.close();
  const reaberta = await context.newPage();
  await reaberta.goto(url);
  await expect(reaberta.getByLabel('Nome')).toHaveValue('Lead Avião');
  await expect(reaberta.getByText('Salvo neste aparelho').first()).toBeVisible();
  await expect(reaberta.getByText('Sincronizado')).toHaveCount(0);

  await context.setOffline(false);
  await expect(reaberta.getByText('Sincronizado').first()).toBeVisible();

  const sessao = await reaberta.evaluate(() => localStorage.getItem('captura7.sessao'));
  expect(sessao).toBeTruthy();
  const dados = JSON.parse(sessao ?? '') as { id: string; papel: string; nome: string };
  const lista = await request.get('http://127.0.0.1:3000/v1/contatos?limite=100', {
    headers: {
      'x-papel-teste': dados.papel,
      'x-usuario-id': dados.id,
      'x-autor-nome': dados.nome,
    },
  });
  expect(lista.ok()).toBeTruthy();
  const corpo = (await lista.json()) as { dados: { nome?: string }[] };
  expect(corpo.dados.filter((item) => item.nome === 'Lead Avião')).toHaveLength(1);
});

async function abrirControlado(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(async () => {
    const registro = await navigator.serviceWorker.ready;
    return Boolean(registro.active);
  });
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
}
