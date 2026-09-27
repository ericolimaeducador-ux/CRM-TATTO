import { expect, test } from '@playwright/test';
import { codigoTotp } from './codigo-totp';

const ADMIN_TESTE = {
  'content-type': 'application/json',
  'x-papel-teste': 'admin',
  'x-usuario-id': '507f1f77bcf86cd799439098',
  'x-autor-nome': 'Admin da prova',
  'x-step-up-teste': '1',
};

test('admin cria contas, entrega senha e 2FA, gera nova senha e regenera 2FA', async ({
  page,
  request,
}) => {
  const sufixo = Date.now().toString(36);
  const loginAdmin = `chefe${sufixo}`;
  const criado = await request.post('/v1/usuarios', {
    headers: ADMIN_TESTE,
    data: { login: loginAdmin, senha: 'senha-provisoria-longa', nome: 'Chefe', papel: 'admin' },
  });
  expect(criado.ok()).toBeTruthy();
  const corpo = (await criado.json()) as {
    dados: { senhaProvisoria: string | null; totp: { segredoBase32: string } };
  };
  expect(corpo.dados.senhaProvisoria).toBeNull();
  const segredo = corpo.dados.totp.segredoBase32;

  // Primeiro acesso da conta admin criada: senha + código, depois a senha própria.
  await page.goto('/entrar');
  await page.getByLabel('Usuário').fill(loginAdmin);
  await page.getByLabel('Senha', { exact: true }).fill('senha-provisoria-longa');
  await page.getByLabel(/Código do autenticador/).fill(codigoTotp(segredo));
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Crie sua nova senha' })).toBeVisible();
  await page.getByLabel('Senha provisória').fill('senha-provisoria-longa');
  await page.getByLabel('Senha nova', { exact: true }).fill('senha-do-chefe-agora');
  await page.getByLabel('Confirme a senha nova').fill('senha-do-chefe-agora');
  await page.getByRole('button', { name: 'Salvar senha nova' }).click();
  await expect(page).toHaveURL(/\/cadastros$/);

  await page.goto('/usuarios');
  const loginVendedor = `vend${sufixo}`;
  await page.getByLabel('Login').fill(loginVendedor);
  await page.getByLabel('Nome').fill('Vendedor Novo');
  await page.getByRole('button', { name: 'Criar usuário' }).click();
  const entrega = page.getByRole('region', {
    name: 'Conta criada: entregue estes dados a Vendedor Novo',
  });
  await expect(entrega).toBeVisible();
  const senhaGerada = (await entrega.getByTestId('senha-provisoria').textContent()) ?? '';
  expect(senhaGerada).toMatch(/^[A-Za-z2-9]{4}(-[A-Za-z2-9]{4}){3}$/);
  await expect(entrega.getByTestId('segredo-totp')).toHaveCount(0);
  await entrega.getByRole('button', { name: 'Já entreguei, esconder' }).click();

  const loginAdmin2 = `adm${sufixo}`;
  await page.getByLabel('Login').fill(loginAdmin2);
  await page.getByLabel('Nome').fill('Admin Dois');
  await page.getByLabel('Perfil').selectOption('admin');
  await page.getByRole('button', { name: 'Criar usuário' }).click();
  const entregaAdmin = page.getByRole('region', {
    name: 'Conta criada: entregue estes dados a Admin Dois',
  });
  await expect(entregaAdmin.getByAltText(/QR code/)).toBeVisible();
  const href =
    (await entregaAdmin
      .getByRole('link', { name: 'Abrir no Google Authenticator' })
      .getAttribute('href')) ?? '';
  expect(href).toContain(`otpauth://totp/TattooArt:${loginAdmin2}?secret=`);
  await entregaAdmin.getByRole('button', { name: 'Já entreguei, esconder' }).click();

  const linhaVendedor = page.locator('li', { hasText: `(${loginVendedor})` });
  await expect(linhaVendedor.getByRole('button', { name: 'Regenerar 2FA' })).toHaveCount(0);
  await linhaVendedor.getByRole('button', { name: 'Gerar nova senha' }).click();
  await linhaVendedor.getByRole('button', { name: 'Confirmar nova senha' }).click();
  const senhaNova = (await linhaVendedor.getByTestId('senha-provisoria').textContent()) ?? '';
  expect(senhaNova).toMatch(/^[A-Za-z2-9]{4}(-[A-Za-z2-9]{4}){3}$/);
  expect(senhaNova).not.toBe(senhaGerada);

  const linhaAdmin2 = page.locator('li', { hasText: `(${loginAdmin2})` });
  await linhaAdmin2.getByRole('button', { name: 'Regenerar 2FA' }).click();
  await linhaAdmin2.getByRole('button', { name: 'Confirmar novo 2FA' }).click();
  await expect(
    linhaAdmin2.getByRole('heading', { name: `Autenticador da conta ${loginAdmin2}` }),
  ).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/captura7/i);

  // A API também trava a senha provisória: só trocar senha, sair e eu.
  const antiga = await request.post('/v1/auth/entrar', {
    data: { login: loginVendedor, senha: senhaGerada },
  });
  expect(antiga.status()).toBe(401);
  const entrada = await request.post('/v1/auth/entrar', {
    data: { login: loginVendedor, senha: senhaNova },
  });
  const dados = (
    (await entrada.json()) as { dados: { token: string; trocarSenhaObrigatoria: boolean } }
  ).dados;
  expect(dados.trocarSenhaObrigatoria).toBe(true);
  const travada = await request.get('/v1/contatos?limite=1', {
    headers: { authorization: `Bearer ${dados.token}` },
  });
  expect(travada.status()).toBe(403);
  expect(await travada.text()).toContain('SENHA_PROVISORIA');
});
