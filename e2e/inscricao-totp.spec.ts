import { expect, test } from '@playwright/test';
import { codigoTotp } from './codigo-totp';

const ADMIN_TESTE = {
  'content-type': 'application/json',
  'x-papel-teste': 'admin',
  'x-usuario-id': '507f1f77bcf86cd799439099',
  'x-autor-nome': 'Admin da prova',
  'x-step-up-teste': '1',
};

test('primeiro acesso do administrador: inscrição em passos e ativação', async ({
  page,
  request,
}) => {
  const login = `primeiro${Date.now()}`;
  const criado = await request.post('/v1/usuarios', {
    headers: ADMIN_TESTE,
    data: { login, senha: 'senha-bem-longa-da-prova', nome: 'Admin Novo', papel: 'admin' },
  });
  expect(criado.ok()).toBeTruthy();

  await page.goto('/entrar');
  await page.getByLabel('Usuário').fill(login);
  await page.getByLabel('Senha', { exact: true }).fill('senha-bem-longa-da-prova');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByText('O administrador precisa inscrever o autenticador')).toBeVisible();
  await expect(page).toHaveURL(/\/entrar$/);
  await expect(page.getByRole('button', { name: 'Trocar senha' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Confirmar passo extra' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Inscrever autenticador' }).click();
  await expect(
    page.getByRole('heading', { name: 'Cadastre o TattooArt no seu autenticador' }),
  ).toBeVisible();
  const link = page.getByRole('link', { name: 'Abrir no Google Authenticator' });
  const href = (await link.getAttribute('href')) ?? '';
  expect(href).toMatch(new RegExp(`^otpauth://totp/TattooArt:${login}\\?secret=[A-Z2-7]+&`));
  expect(href).toContain('issuer=TattooArt');
  await expect(
    page.getByAltText('QR code para cadastrar o TattooArt no autenticador'),
  ).toBeVisible();
  const chaveVisivel = (await page.getByTestId('segredo-totp').textContent()) ?? '';
  expect(chaveVisivel).toMatch(/^([A-Z2-7]{4} )*[A-Z2-7]{1,4}$/);
  const segredo = chaveVisivel.replace(/\s+/g, '');
  expect(href).toContain(`secret=${segredo}&`);
  await expect(page.locator('body')).not.toContainText(/captura7/i);

  await page.getByLabel('Código de 6 dígitos do autenticador').fill(codigoTotp(segredo));
  await page.getByRole('button', { name: 'Ativar autenticador' }).click();
  await expect(page.getByText('Autenticador ativado.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Trocar senha' })).toBeVisible();
});
