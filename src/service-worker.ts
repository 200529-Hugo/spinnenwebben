/// <reference lib="webworker" />
import { build, files, prerendered, version } from '$service-worker';

const worker = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `spinnenwebben-${version}`;
const ASSETS = [...build, ...files, ...prerendered];
const APP_ROOT = new URL('./', worker.registration.scope).pathname;

worker.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => worker.skipWaiting()));
});

worker.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => worker.clients.claim()));
});

worker.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(event.request, copy));
      return response;
    }).catch(async () => (await caches.match(event.request)) ?? (await caches.match(APP_ROOT)) as Response));
    return;
  }

  event.respondWith(fetch(event.request).then((response) => {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(event.request, copy));
    return response;
  }).catch(async () => (await caches.match(event.request)) ?? (await caches.match(`${APP_ROOT}index.html`)) as Response));
});
