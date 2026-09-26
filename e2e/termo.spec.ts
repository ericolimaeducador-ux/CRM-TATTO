import { expect, test } from '@playwright/test';

const VENDEDOR = '507f1f77bcf86cd799439011';

test('captura segue sem trava e o autocadastro só conclui com a caixa', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Digitar' }).click();
  await expect(page.getByText('Consentimento de contato comercial: pendente')).toBeVisible();
  await expect(page.getByLabel('Nome')).toBeVisible();

  const qr = await page.request.post('/v1/qr', {
    headers: {
      'content-type': 'application/json',
      'x-papel-teste': 'vendedor',
      'x-usuario-id': VENDEDOR,
      'x-autor-nome': 'Vendedor do ensaio',
    },
    data: {},
  });
  expect(qr.ok()).toBeTruthy();
  const corpo = (await qr.json()) as { dados: { caminho: string } };
  await page.goto(corpo.dados.caminho);
  const destaque = page.getByTestId('destaque-consentimento');
  await expect(destaque).toBeVisible();
  const caixa = await destaque.boundingBox();
  expect((caixa?.y ?? 999) + (caixa?.height ?? 0)).toBeLessThanOrEqual(800);
  const concluir = page.getByRole('button', { name: 'Concluir cadastro' });
  await expect(concluir).toBeDisabled();
  await page.getByRole('checkbox').check();
  await expect(concluir).toBeEnabled();
  await concluir.click();
  await expect(page.getByText('Cadastro concluído.')).toBeVisible();
  await expect(page.getByText('Sincronizado')).toHaveCount(0);
});
