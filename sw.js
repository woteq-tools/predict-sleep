/**
 * Sleep Predictor - service worker.
 *
 * The app is a small static site, so the whole shell is precached on install
 * and served cache first. That makes the app work offline and makes it start
 * instantly, even on a slow connection.
 *
 * Bump `CACHE_VERSION` whenever the app shell changes: the new worker
 * precaches the new files and deletes the old cache on activate.
 */

const CACHE_VERSION = 'sleep-v2';
const CACHE_NAME = CACHE_VERSION;

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
 * The URL that is used to cache a file.
 *
 * The version is added as a query parameter on purpose: while the new worker
 * installs, the *old* worker is still in charge and would answer a plain
 * request for `/styles.css` from its own cache. A different URL cannot be
 * answered from the old cache, so the new worker always stores fresh files.
 *
 * @param {string} url
 * @returns {string}
 */
function cacheUrl(url) {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${CACHE_VERSION}`;
}

/**
 * Cache the app shell. Individual failures are ignored so that one missing
 * optional file cannot break the whole installation.
 * @returns {Promise<void>}
 */
async function precache() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.allSettled(
    PRECACHE_URLS.map(async (url) => {
      const response = await fetch(cacheUrl(url), { cache: 'reload' });
      if (response && response.ok) await cache.put(cacheUrl(url), response);
    }),
  );
}

/**
 * Remove every cache that is not the current one.
 * @returns {Promise<void>}
 */
async function cleanOldCaches() {
  const names = await caches.keys();
  await Promise.all(
    names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)),
  );
}

/**
 * Look up a request in the cache, ignoring the version query parameter.
 * @param {Request|string} request
 * @returns {Promise<Response|undefined>}
 */
function matchCache(request) {
  return caches.match(request, { ignoreSearch: true });
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(cleanOldCaches().then(() => self.clients.claim()));
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
      matchCache('./index.html')
        .then((cached) => cached || fetch(request))
        .catch(() => matchCache('./index.html')),
    );
    return;
  }

  event.respondWith(
    matchCache(request).then((cached) => {
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
