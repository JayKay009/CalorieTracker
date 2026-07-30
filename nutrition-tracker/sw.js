/**
 * sw.js — minimal app-shell cache so the interface (not necessarily every
 * asset) works offline once it's been opened at least once.
 * OCR (Tesseract.js) and any food-database lookups are handled/cached
 * separately when those phases are built.
 */

const CACHE_NAME = 'plate-shell-v1';
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
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).catch(() => caches.match('./index.html'))
    )
  );
});
