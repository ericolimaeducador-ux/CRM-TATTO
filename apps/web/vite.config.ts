import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

function basePublica(): string {
  const bruto = process.env.PAGES_BASE ?? '/';
  if (bruto === '/' || bruto === '') return '/';
  const comBarra = bruto.endsWith('/') ? bruto : `${bruto}/`;
  return comBarra.startsWith('/') ? comBarra : `/${comBarra}`;
}

const base = basePublica();

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'public',
      filename: 'sw.js',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,ico,png,woff2,webmanifest}'],
      },
      manifest: {
        name: 'Tela Viva — Carteira & visitas',
        short_name: 'Tela Viva',
        lang: 'pt-BR',
        id: base,
        display: 'standalone',
        start_url: base,
        scope: base,
        background_color: '#FBF7F1',
        theme_color: '#F2EADF',
        icons: [
          { src: 'brand/icone-pwa.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      devOptions: { enabled: false, type: 'module' },
    }),
  ],
  resolve: {
    alias: { '@': '/src' },
  },
  server: {
    proxy: { '/v1': 'http://127.0.0.1:3000' },
  },
  preview: {
    proxy: { '/v1': process.env.CAPTURA7_API_PROXY ?? 'http://127.0.0.1:3000' },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    passWithNoTests: true,
  },
});
