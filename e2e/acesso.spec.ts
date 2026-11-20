import { expect, test } from '@playwright/test';

const API = 'http://127.0.0.1:3101';
const senha = 'senha-isolada-para-qa';

test('administrador inscrito entra sem 2FA, cria membro e membro entra sem permissão administrativa', async ({
  page,
  request,
}) => {
  const sufixo = Date.now().toString(36);
  const admin = `admin-acesso-${sufixo}`;
  const membro = `membro-acesso-${sufixo}`;
  const seed = await request.post(`${API}/v1/usuarios`, {
    headers: { 'x-papel-teste': 'admin', 'x-usuario-id': '507f1f77bcf86cd799439099' },
    data: { login: admin, senha, nome: 'Administrador QA acesso', papel: 'admin' },
  });
  expect(seed.status()).toBe(201);
  const entrada = await request.post(`${API}/v1/auth/entrar`, { data: { login: admin, senha } });
  expect(entrada.status()).toBe(201);
  const token = (await entrada.json()).dados.token as string;
  const inscricao = await request.post(`${API}/v1/auth/totp/inscrever`, {
    headers: { authorization: `Bearer ${token}` },
    data: {},
  });
  expect(inscricao.status()).toBe(201);
  await request.post(`${API}/v1/auth/sair`, { headers: { authorization: `Bearer ${token}` } });

  await page.goto('/entrar');
  await expect(page.getByRole('heading', { name: 'Entrar no CRM' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Seções' })).toHaveCount(0);
  await expect(page.getByLabel(/autenticador/i)).toHaveCount(0);
  await page.getByLabel('Usuário', { exact: true }).fill(admin);
  await page.getByLabel('Senha', { exact: true }).fill(senha);
  await page.getByLabel('Mostrar senha').check();
  await expect(page.getByLabel('Senha', { exact: true })).toHaveAttribute('type', 'text');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const botao = await page.getByRole('button', { name: 'Entrar', exact: true }).boundingBox();
  expect(botao?.height).toBeGreaterThanOrEqual(48);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('#navegacao-principal')).toHaveAttribute('inert', '');
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('captura7.perfil') ?? '{}').papel),
  ).toBe('admin');
  const euAdmin = await page.evaluate(async () => {
    const resposta = await fetch('http://127.0.0.1:3101/v1/auth/eu', {
      headers: { authorization: `Bearer ${localStorage.getItem('captura7.token')}` },
    });
    return resposta.json();
  });
  expect(euAdmin.dados.stepUp).toBe(false);

  await page.goto('/usuarios');
  await page.getByLabel('Nome', { exact: true }).fill('Membro QA acesso');
  await page.getByLabel('Usuário', { exact: true }).fill(membro);
  await page.getByLabel('Senha de 12 caracteres ou mais').fill(senha);
  await page.getByRole('combobox', { name: 'Perfil', exact: true }).selectOption('vendedor');
  await page.getByRole('button', { name: 'Criar usuário', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Usuário criado.' })).toBeVisible();
  await expect(page.getByText('Membro QA acesso', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.goto('/minha-conta');
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  await expect(page.getByText('Sessão encerrada neste aparelho e no servidor.')).toBeVisible();
  await page.getByRole('link', { name: 'Entrar no Tela Viva', exact: true }).click();
  await page.getByLabel('Usuário', { exact: true }).fill(membro);
  await page.getByLabel('Senha', { exact: true }).fill(senha);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  const tokenMembro = await page.evaluate(() => localStorage.getItem('captura7.token'));
  const negado = await request.post(`${API}/v1/usuarios`, {
    headers: { authorization: `Bearer ${tokenMembro}` },
    data: { login: `indevido-${sufixo}`, senha, nome: 'Não criar', papel: 'admin' },
  });
  expect(negado.status()).toBe(403);
  await page.goto('/usuarios');
  await expect(
    page.getByText('Entre com um perfil de administrador para gerenciar a equipe.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Criar usuário' })).toHaveCount(0);
});
