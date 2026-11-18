import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('treinamento recebe inscrição pelo QR, registra presença e alimenta relatório agregado', async ({
  page,
  context,
  request,
}) => {
  const id = '507f1f77bcf86cd799439091';
  const headers = {
    'x-papel-teste': 'admin',
    'x-usuario-id': id,
    'x-autor-nome': 'QA de paridade',
  };
  await page.addInitScript(
    ({ id }) => {
      const perfil = JSON.stringify({ id, papel: 'admin', nome: 'QA de paridade' });
      localStorage.setItem('captura7.sessao', perfil);
      localStorage.setItem('captura7.perfil', perfil);
    },
    { id },
  );
  const eventoResposta = await request.post('http://127.0.0.1:3101/v1/comercial/treinamentos', {
    headers,
    data: {
      titulo: 'Treinamento QA isolado',
      tipo: 'online',
      dataInicio: new Date(Date.now() + 86_400_000).toISOString(),
      dataFim: new Date(Date.now() + 90_000_000).toISOString(),
      marca: 'Tela Viva',
    },
  });
  expect(eventoResposta.status()).toBe(201);
  const evento = (await eventoResposta.json()).registro;
  await page.goto(`/treinamentos/${evento._id}`);
  await expect(
    page.getByRole('heading', { name: 'Treinamento QA isolado', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Abrir inscrições por QR', exact: true }).click();
  await page.getByRole('button', { name: 'Gerar QR de inscrição', exact: true }).click();
  await expect(
    page.getByRole('img', { name: 'QR de inscrição: Treinamento QA isolado' }),
  ).toBeVisible();
  const link = await page.getByLabel('Link público de inscrição').inputValue();
  const visitante = await context.newPage();
  await visitante.goto(link);
  await visitante.getByLabel('Nome para inscrição').fill('Participante QA público');
  await visitante.getByLabel('E-mail para inscrição').fill('paridade-publico@exemplo.test');
  await visitante.getByRole('button', { name: 'Registrar minha inscrição' }).click();
  await expect(visitante.getByRole('heading', { name: 'Inscrição registrada.' })).toBeVisible();
  expect(await visitante.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
    true,
  );
  await visitante.close();
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.reload();
  await expect(page.getByText('Participante QA público', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Marcar presente', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar alteração', exact: true }).click();
  await expect(page.getByText('Presença: registrada', { exact: true })).toBeVisible();
  const respostaRelatorio = page.waitForResponse((r) =>
    r.url().includes('/v1/comercial/relatorios?'),
  );
  await page.goto('/relatorios');
  const respostaOriginal = await respostaRelatorio;
  const relatorioOriginal = await respostaOriginal.json();
  const inscritosResposta = await request.get(
    `http://127.0.0.1:3101/v1/comercial/participantes?treinamentoId=${evento._id}`,
    { headers },
  );
  const inscritos = await inscritosResposta.json();
  const diaUtc = new Date().toISOString().slice(0, 10);
  const comparacao = await request.get(
    `http://127.0.0.1:3101/v1/comercial/relatorios?de=${relatorioOriginal.periodo.de}&ate=${diaUtc}`,
    { headers },
  );
  const diagnostico = JSON.stringify(
    {
      horarioBrowser: await page.evaluate(() => ({
        agora: new Date().toISOString(),
        local: new Date().toString(),
        fuso: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })),
      consulta: respostaOriginal.url(),
      status: respostaOriginal.status(),
      periodo: relatorioOriginal.periodo,
      participantesNoRelatorio: relatorioOriginal.participantes,
      participantesGravados: inscritos.registros.map(
        (p: { criadoEm: string; status: string; confirmado: boolean; presente: boolean }) => ({
          criadoEm: p.criadoEm,
          status: p.status,
          confirmado: p.confirmado,
          presente: p.presente,
        }),
      ),
      comparacaoAteUtc: (await comparacao.json()).participantes,
    },
    null,
    2,
  );
  writeFileSync(test.info().outputPath('diagnostico-relatorio-fuso.json'), diagnostico);
  await test.info().attach('diagnostico-relatorio-fuso.json', {
    contentType: 'application/json',
    body: diagnostico,
  });
  await expect(
    page.getByRole('heading', { name: 'Relatórios comerciais', exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator('.tv-report-participation')
      .locator('div')
      .filter({ hasText: 'Presenças registradas' })
      .locator('dd'),
  ).toHaveText('1');
  await expect(page.getByText('paridade-publico@exemplo.test', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
