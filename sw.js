// sw.js - Service Worker for LingoGoc AI PWA Offline Mode
const CACHE_NAME = 'lingogoc-pwa-v12';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './favicon.svg'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event (Network First with Cache Fallback)
self.addEventListener('fetch', (event) => {
  // Ignore mutations, browser-extension resources and third-party requests.
  // CacheStorage only accepts HTTP(S) requests, and external APIs already
  // provide their own caching/fallback behavior.
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);
  if (!['http:', 'https:'].includes(requestUrl.protocol)) return;
  if (requestUrl.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(async (networkResponse) => {
        // Only cache successful same-origin responses. Await and contain the
        // write so a rejected Cache.put() never becomes an unhandled promise.
        if (networkResponse?.ok && networkResponse.type === 'basic') {
          try {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(event.request, networkResponse.clone());
          } catch (error) {
            console.warn('Service worker cache write skipped:', error);
          }
        }
        return networkResponse;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) return cachedResponse;

        if (event.request.mode === 'navigate') {
          const appShell = await caches.match('./index.html');
          if (appShell) return appShell;
        }

        return new Response('LingoGoc is offline.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      })
  );
});
