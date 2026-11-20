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
  await expect(page.getByRole('link', { name: 'Ler o termo' })).toBeVisible();
  const caixa = await page.getByRole('checkbox', { name: /contato comercial/i }).boundingBox();
  expect((caixa?.y ?? 999) + (caixa?.height ?? 0)).toBeLessThanOrEqual(800);
  const concluir = page.getByRole('button', { name: 'Concluir cadastro' });
  await expect(concluir).toBeDisabled();
  await page.getByRole('checkbox', { name: /contato comercial/i }).check();
  const pergunta = page.getByTestId('pergunta-captcha');
  await expect(pergunta).toBeVisible();
  const numeros = ((await pergunta.innerText()).match(/\d+/g) ?? []).map(Number);
  await page.getByLabel('Resposta do desafio').fill(String((numeros[0] ?? 0) + (numeros[1] ?? 0)));
  await expect(concluir).toBeEnabled();
  await concluir.click();
  await expect(page.getByTestId('cadastro-concluido')).toContainText('CADASTRO CONCLUÍDO');
  await expect(page.getByText('Sincronizado')).toHaveCount(0);
});
