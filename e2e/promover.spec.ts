import { expect, test } from '@playwright/test';

const GESTOR = {
  id: '507f1f77bcf86cd799439011',
  papel: 'gestor',
  nome: 'Gestor da prova',
};

test('a promoção explica o código obrigatório e a captura segue livre', async ({
  page,
  request,
}) => {
  const cabecalhos = {
    'content-type': 'application/json',
    'x-papel-teste': 'gestor',
    'x-usuario-id': GESTOR.id,
    'x-autor-nome': GESTOR.nome,
  };
  const criado = await request.post('/v1/contatos', {
    headers: cabecalhos,
    data: { nome: 'Ana Promo' },
  });
  expect(criado.ok()).toBeTruthy();
  const id = ((await criado.json()) as { dados: { _id: string } }).dados._id;

  await page.addInitScript((sessao) => {
    localStorage.setItem('captura7.sessao', JSON.stringify(sessao));
  }, GESTOR);
  await page.goto(`/promover/${id}`);
  await expect(page.getByText('única tela com campo obrigatório')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Promover Ana Promo a cliente' })).toBeVisible();
  const campo = page.getByLabel('Código TOTP obrigatório nesta tela');
  const caixa = await campo.boundingBox();
  expect(caixa).not.toBeNull();
  expect(caixa?.height).toBeGreaterThanOrEqual(48);
  expect((caixa?.x ?? 0) + (caixa?.width ?? 0)).toBeLessThanOrEqual(360);

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Digitar' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Ler QR' })).toBeEnabled();
});
