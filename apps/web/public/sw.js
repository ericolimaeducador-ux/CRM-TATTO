/* global self */
import { createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkOnly } from 'workbox-strategies';

const VERSAO = 'captura7-sw-1';

self.addEventListener('install', () => {
  void self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(self.clients.claim());
});

precacheAndRoute(self.__WB_MANIFEST);

registerRoute(
  ({ url, request }) => url.pathname.startsWith('/v1/') || request.method !== 'GET',
  new NetworkOnly(),
);

registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')));

self.addEventListener('message', (evento) => {
  if (evento.data === 'VERSAO') evento.ports[0]?.postMessage(VERSAO);
});
