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
        globPatterns: ['**/*.{js,css,html,svg,ico,png,webmanifest}'],
      },
      manifest: {
        name: 'captura7',
        short_name: 'captura7',
        lang: 'pt-BR',
        id: base,
        display: 'standalone',
        start_url: base,
        scope: base,
        background_color: '#1c1917',
        theme_color: '#1c1917',
        icons: [
          { src: 'icone-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icone-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
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
