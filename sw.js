/**
 * Sleep Predictor - service worker.
 *
 * The app is a small static site, so the whole shell is precached on install
 * and served cache first. That makes the app work offline and makes it start
 * instantly, even on a slow connection.
 *
 * Bump `CACHE_NAME` whenever the app shell changes: the new worker precaches
 * the new files and deletes the old cache on activate.
 */

const CACHE_NAME = 'sleep-v2';

const PRECACHE_URLS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './time.js',
  './storage.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon-180.png',
  './icons/favicon-32.png',
];

/**
 * Cache the app shell. Individual failures are ignored so that one missing
 * optional file cannot break the whole installation.
 * @param {string} cacheName
 * @returns {Promise<void>}
 */
async function precache(cacheName) {
  const cache = await caches.open(cacheName);
  await Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)));
}

/**
 * Remove every cache that is not the current one.
 * @param {string} cacheName
 * @returns {Promise<void>}
 */
async function cleanOldCaches(cacheName) {
  const names = await caches.keys();
  await Promise.all(
    names.filter((name) => name !== cacheName).map((name) => caches.delete(name)),
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache(CACHE_NAME).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(cleanOldCaches(CACHE_NAME).then(() => self.clients.claim()));
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;

  // Never touch a range request or a prefetch from another origin.
  if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations always end up on the app shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      caches
        .match('./index.html')
        .then((cached) => cached || fetch(request))
        .catch(() => caches.match('./index.html')),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          // Keep a copy of everything that comes from our own origin.
          if (response && response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => Response.error());
    }),
  );
});
