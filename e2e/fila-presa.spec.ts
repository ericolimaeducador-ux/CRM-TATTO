import { expect, test } from '@playwright/test';

test('item preso na fila mostra alerta e exportação', async ({ page, context }) => {
  await page.addInitScript(() => {
    Object.assign(window, { __CAPTURA7_BACKOFF_MS: 0 });
  });
  await context.route('**/v1/**', (rota) => rota.abort());
  await page.goto('/');
  await page.getByRole('button', { name: 'Digitar' }).click();
  await page.getByLabel('Nome').fill('Preso Aqui');
  await expect(page.getByText(/Salvo neste aparelho|Enviando…|Preso na fila/)).toBeVisible();
  await page.getByRole('link', { name: 'Captura' }).click();
  await page.getByRole('link', { name: 'Fila' }).click();
  await expect(page.getByText('Este registro está preso na fila.')).toBeVisible({
    timeout: 60_000,
  });
  await expect(
    page.getByRole('button', { name: 'Exportar este registro como JSON' }),
  ).toBeVisible();
  await expect(page.getByText(/^Salvo$/)).toHaveCount(0);
});
