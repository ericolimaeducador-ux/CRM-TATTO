import { expect, test } from '@playwright/test';

const API = 'http://127.0.0.1:3101';
test.use({ viewport: { width: 1440, height: 1000 } });

test('outro navegador consulta contatos do CRM sem copiá-los para a fila local e navegação volta ao topo', async ({
  page,
  browser,
  request,
}) => {
  const sufixo = Date.now().toString(36);
  const login = `contatos-remotos-${sufixo}`;
  const senha = 'senha-qa-remotos-isolados';
  const criado = await request.post(`${API}/v1/usuarios`, {
    headers: { 'x-papel-teste': 'admin', 'x-usuario-id': '507f1f77bcf86cd799439098' },
    data: { login, senha, nome: 'QA contatos remotos', papel: 'admin' },
  });
  expect(criado.status()).toBe(201);
  await page.goto('/entrar');
  await page.getByLabel('Usuário', { exact: true }).fill(login);
  await page.getByLabel('Senha', { exact: true }).fill(senha);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  const nome = `Contato do Navegador Remoto ${sufixo.charAt(0).toUpperCase()}${sufixo.slice(1)}`;
  const id = await page.evaluate(
    async ({ api, nomeContato }) => {
      const resposta = await fetch(`${api}/v1/contatos`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${localStorage.getItem('captura7.token')}`,
        },
        body: JSON.stringify({ nome: nomeContato }),
      });
      if (!resposta.ok) throw new Error('Não criou contato isolado.');
      return (await resposta.json()).dados._id as string;
    },
    { api: API, nomeContato: nome },
  );

  const outro = await browser.newContext({
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1440, height: 1000 },
  });
  try {
    const paginaB = await outro.newPage();
    await paginaB.goto('/entrar');
    await paginaB.getByLabel('Usuário', { exact: true }).fill(login);
    await paginaB.getByLabel('Senha', { exact: true }).fill(senha);
    await paginaB.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(paginaB).toHaveURL(/\/$/);
    await paginaB.getByRole('link', { name: 'Contatos', exact: true }).click();
    const remoto = paginaB.getByRole('link', { name: nome, exact: true });
    await expect(remoto).toHaveAttribute('href', `/lead/${id}`);
    await expect(remoto.locator('..')).toContainText('Salvo no CRM');
    const contagens = await paginaB.evaluate(async () => {
      return new Promise<{ contatos: number; operacoes: number }>((resolve, reject) => {
        const pedido = indexedDB.open('captura7');
        pedido.onerror = () => reject(pedido.error);
        pedido.onsuccess = () => {
          const db = pedido.result;
          const tx = db.transaction(['contatos', 'operacoes'], 'readonly');
          const contatos = tx.objectStore('contatos').count();
          const operacoes = tx.objectStore('operacoes').count();
          tx.oncomplete = () => {
            db.close();
            resolve({ contatos: contatos.result, operacoes: operacoes.result });
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
        };
      });
    });
    expect(contagens).toEqual({ contatos: 0, operacoes: 0 });
    await remoto.click();
    await expect(paginaB).toHaveURL(new RegExp(`/lead/${id}$`));
    await paginaB.getByRole('link', { name: 'Minha conta', exact: true }).click();
    await paginaB.getByText('Confirmar operações sensíveis', { exact: true }).click();
    await paginaB.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    expect(await paginaB.evaluate(() => scrollY)).toBeGreaterThan(0);
    // Dispara navegação SPA sem o auto-scroll do click do Playwright no menu fixo.
    await paginaB
      .getByRole('link', { name: 'Agenda de visitas', exact: true })
      .evaluate((link) => (link as HTMLAnchorElement).click());
    await expect(paginaB).toHaveURL(/\/agenda$/);
    await expect.poll(() => paginaB.evaluate(() => scrollY)).toBe(0);
  } finally {
    await outro.close();
  }
});
