import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 360, height: 800 },
    serviceWorkers: 'allow',
  },
  webServer: [
    {
      command: 'node e2e/subir-api.cjs',
      cwd: '..',
      url: 'http://127.0.0.1:3000/v1/saude',
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      command: 'pnpm --filter @captura7/web preview --host 127.0.0.1 --port 4173 --strictPort',
      cwd: '..',
      url: 'http://127.0.0.1:4173',
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
});
