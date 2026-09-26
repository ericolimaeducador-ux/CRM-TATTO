import { expect, test } from '@playwright/test';

const GESTOR = {
  id: '507f1f77bcf86cd799439011',
  papel: 'gestor',
  nome: 'Gestor da prova',
};

test('a fusão mostra o efeito e só descarta depois da escolha', async ({ page, request }) => {
  const cabecalhos = {
    'content-type': 'application/json',
    'x-papel-teste': 'gestor',
    'x-usuario-id': GESTOR.id,
    'x-autor-nome': GESTOR.nome,
    'x-step-up-teste': '1',
  };
  const casaA = await request.post('/v1/contatos', {
    headers: cabecalhos,
    data: { nome: 'Casa Merge A', email: 'merge-a@exemplo.com', telefone: '11911112222' },
  });
  const casaB = await request.post('/v1/contatos', {
    headers: cabecalhos,
    data: { nome: 'Casa Merge B', email: 'merge-b@exemplo.com', telefone: '11933334444' },
  });
  expect(casaA.ok()).toBeTruthy();
  expect(casaB.ok()).toBeTruthy();
  const idA = ((await casaA.json()) as { dados: { _id: string } }).dados._id;
  const idB = ((await casaB.json()) as { dados: { _id: string } }).dados._id;

  const semConfirmacao = await request.post(`/v1/contatos/${idA}/merge`, {
    headers: cabecalhos,
    data: { absorvidoId: idB, confirmacao: false, valoresEscolhidos: { nome: 'absorvido' } },
  });
  expect(semConfirmacao.status()).toBe(422);

  await page.addInitScript((sessao) => {
    localStorage.setItem('captura7.sessao', JSON.stringify(sessao));
  }, GESTOR);
  await page.goto(`/merge/${idA}/${idB}`);
  await expect(page.getByText('B será descartado e recuperável por 90 dias.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fundir com esta escolha' })).toBeEnabled();
  await page.getByLabel(/Código TOTP/).fill('123456');
  await page.getByRole('button', { name: 'Fundir com esta escolha' }).click();
  await expect(
    page.getByText('O contato B foi descartado e pode ser recuperado por 90 dias.'),
  ).toBeVisible();

  const lido = await request.get(`/v1/contatos/${idB}`, { headers: cabecalhos });
  const corpo = (await lido.json()) as { dados: { status: string; fundidoEm: string } };
  expect(corpo.dados.status).toBe('descartado');
  expect(corpo.dados.fundidoEm).toBe(idA);
});
