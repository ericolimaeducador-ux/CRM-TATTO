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
  // Sem dados, a tela explica o que falta e não pede o código (ADR-031).
  await page.goto(`/promover/${id}`);
  await expect(
    page.getByRole('heading', { name: 'Ana Promo ainda não pode virar cliente' }),
  ).toBeVisible();
  await expect(page.getByLabel('Código TOTP obrigatório nesta tela')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Abrir a ficha de Ana Promo' })).toBeVisible();

  const pronta = await request.post('/v1/contatos', {
    headers: cabecalhos,
    data: {
      nome: 'Bia Pronta',
      telefone: '11977771234',
      cpf: '52998224725',
      logradouro: 'Rua A',
      numero: '10',
      cidade: 'São Paulo',
      uf: 'SP',
      tipoPessoa: 'PF',
    },
  });
  expect(pronta.ok()).toBeTruthy();
  const idPronta = ((await pronta.json()) as { dados: { _id: string } }).dados._id;
  const qualificada = await request.post(`/v1/contatos/${idPronta}/transicao`, {
    headers: cabecalhos,
    data: { para: 'qualificado' },
  });
  expect(qualificada.ok()).toBeTruthy();
  await page.goto(`/promover/${idPronta}`);
  await expect(page.getByText('única tela com campo obrigatório')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Promover Bia Pronta a cliente' })).toBeVisible();
  const campo = page.getByLabel('Código TOTP obrigatório nesta tela');
  const caixa = await campo.boundingBox();
  expect(caixa).not.toBeNull();
  expect(caixa?.height).toBeGreaterThanOrEqual(48);
  expect((caixa?.x ?? 0) + (caixa?.width ?? 0)).toBeLessThanOrEqual(360);

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Digitar' })).toBeEnabled();
  await expect(page.getByRole('link', { name: 'Ler QR' })).toBeEnabled();
});
