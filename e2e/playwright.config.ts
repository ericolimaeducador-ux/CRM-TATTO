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
      url: 'http://127.0.0.1:3101/v1/saude',
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      command:
        'node apps/web/node_modules/vite/bin/vite.js preview apps/web --host 127.0.0.1 --port 4173 --strictPort',
      cwd: '..',
      env: { ...process.env, CAPTURA7_API_PROXY: 'http://127.0.0.1:3101' },
      url: 'http://127.0.0.1:4173',
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
});
