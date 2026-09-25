import { expect, test } from '@playwright/test';

test('fechar a aba no meio do autosave guarda o nome', async ({ page, context }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Digitar' }).click();
  const nome = page.getByLabel('Nome');
  await nome.focus();
  await page.keyboard.type('Aba Morta');
  const url = page.url();
  await page.close({ runBeforeUnload: true });

  const reaberta = await context.newPage();
  await reaberta.goto(url);
  await expect(reaberta.getByLabel('Nome')).toHaveValue('Aba Morta');
});
