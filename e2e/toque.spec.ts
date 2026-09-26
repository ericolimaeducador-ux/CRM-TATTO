import { expect, test } from '@playwright/test';

test('em 360px o caminho de digitar cabe no polegar', async ({ page }) => {
  await page.goto('/');
  const botao = page.getByRole('button', { name: 'Digitar' });
  const caixa = await botao.boundingBox();
  expect(caixa).not.toBeNull();
  expect(caixa?.height).toBeGreaterThanOrEqual(48);
  expect((caixa?.x ?? 0) + (caixa?.width ?? 0)).toBeLessThanOrEqual(360);
  await botao.click();
  await expect(page.getByLabel('Nome')).toBeFocused();
});
