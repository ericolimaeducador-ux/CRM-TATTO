import { expect, test } from '@playwright/test';

test('painel Mais fecha ao escolher item, tocar fora, Escape e Voltar', async ({ page }) => {
  await page.goto('/capturar');
  const mais = page.getByRole('button', { name: 'Mais' });
  const painel = page.locator('#painel-mais');
  const fundo = page.locator('.fundo-sobreposicao');

  await mais.click();
  await expect(painel).toBeVisible();
  await page.getByRole('link', { name: 'Meu QR' }).click();
  await expect(page).toHaveURL(/\/meu-qr$/);
  await expect(painel).toBeHidden();
  await expect(fundo).toHaveCount(0);

  await mais.click();
  await expect(painel).toBeVisible();
  await page.mouse.click(180, 40);
  await expect(painel).toBeHidden();
  await expect(page).toHaveURL(/\/meu-qr$/);

  await mais.click();
  await expect(painel).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(painel).toBeHidden();

  await mais.click();
  await expect(painel).toBeVisible();
  await page.goBack();
  await expect(painel).toBeHidden();
  await expect(page).toHaveURL(/\/meu-qr$/);

  await mais.click();
  await expect(painel).toBeVisible();
  await mais.click();
  await expect(painel).toBeHidden();

  // O Voltar depois de escolher um item volta para a página anterior, sem sobra no histórico.
  await page.goBack();
  await expect(page).toHaveURL(/\/capturar$/);
});
