const CACHE_NAME = 'edrops-cache-v1';
const OFFLINE_URL = '/offline.html';

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/icons.svg',
  '/offline.html',
  '/manifest.json'
];

// Install Event - Pre-cache Core Shell Assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event - Clean Up Old Caches and Take Control
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Caching and Fallback Strategies
self.addEventListener('fetch', (event) => {
  // Only intercept GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Ignore API requests, websockets, and Vite development paths
  if (
    url.pathname.startsWith('/api') || 
    url.pathname.startsWith('/socket.io') || 
    event.request.url.includes('hot-update') || 
    url.pathname.includes('@vite') ||
    url.pathname.includes('@react-refresh')
  ) {
    return;
  }

  // Navigation Request (HTML page loads) - Network-first with offline page fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // If valid response, cache a copy of it
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => {
          // Network failed, attempt cache fallback, then offline.html
          return caches.match(event.request)
            .then((cachedResponse) => cachedResponse || caches.match(OFFLINE_URL));
        })
    );
    return;
  }

  // Static Assets (CSS, JS, Images, Fonts) - Stale-While-Revalidate caching
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() => {
          // Silent catch: network failures of static assets return cached fallback if available
        });

      return cachedResponse || fetchPromise;
    })
  );
});
