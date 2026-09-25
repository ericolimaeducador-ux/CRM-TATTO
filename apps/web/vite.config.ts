import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'public',
      filename: 'sw.js',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,ico,webmanifest}'],
      },
      manifest: {
        name: 'captura7',
        short_name: 'captura7',
        lang: 'pt-BR',
        display: 'standalone',
        start_url: '/',
      },
      devOptions: { enabled: true, type: 'module' },
    }),
  ],
  resolve: {
    alias: { '@': '/src' },
  },
  server: {
    proxy: { '/v1': 'http://127.0.0.1:3000' },
  },
  preview: {
    proxy: { '/v1': 'http://127.0.0.1:3000' },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    passWithNoTests: true,
  },
});
