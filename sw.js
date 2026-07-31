/**
 * sw.js — app-shell cache for offline use.
 *
 * Strategy: network-first, cache as fallback. This is deliberate — a
 * cache-first strategy means updates never show up until sw.js itself
 * changes bytes (easy to forget when only app.js/index.html etc. change,
 * and it did cause a real stuck-on-old-version bug during development).
 * Network-first means deploys always show up immediately when online, and
 * the cache is purely a safety net for when there's no connection at all.
 */

const CACHE_NAME = 'plate-shell-v2'; // bumped to force a clean break from the old stale v1 cache
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './js/db.js',
  './js/units.js',
  './js/starter-foods-data.js',
  './js/settingsPanel.js',
  './js/history.js',
  './js/mealBuilder.js',
  './js/ocr.js',
  './icons/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Opportunistically refresh the offline cache with whatever we just
        // got from the network, without blocking the response on it.
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        return networkResponse;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => cached || caches.match('./index.html'))
      )
  );
});
