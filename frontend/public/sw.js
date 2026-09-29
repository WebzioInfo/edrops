const CACHE_NAME = 'edrops-cache-v9';
const OFFLINE_URL = '/offline.html';

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/logo-pwa.png',
  '/logo-full-blue.svg',
  '/logo-full-white.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-192-maskable.png',
  '/icon-512-maskable.png',
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

// =========================================================================
// WEB PUSH NOTIFICATIONS
// =========================================================================

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    try {
      data = { title: 'eDrops', body: event.data ? event.data.text() : 'New update received' };
    } catch (err) {
      data = { title: 'eDrops', body: 'New notification from eDrops' };
    }
  }

  const title = data.title || 'eDrops';
  const tag = data.entityId ? `edrops-order-${data.entityId}` : `edrops-push-${data.notificationId || Date.now()}`;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if application window is in the foreground / focused
      const focusedClient = clientList.find((client) => client.focused);

      if (focusedClient) {
        // App is open in foreground: post message to window to let in-app UI / toast handle it
        focusedClient.postMessage({
          type: 'PUSH_NOTIFICATION_FOREGROUND',
          payload: data,
        });

        // Browsers require a push handler to display a notification or complete.
        // If the window is focused, we skip OS notification to prevent annoying duplicate toasts.
        return Promise.resolve();
      }

      // App is in background or closed: show OS notification
      const options = {
        body: data.body || 'You have an update regarding your order.',
        icon: data.icon || '/icon-192.png',
        badge: data.badge || '/icon-192.png',
        image: data.image || undefined,
        tag: tag,
        renotify: true,
        data: {
          url: data.url || '/',
          entityId: data.entityId,
          type: data.type,
          notificationId: data.notificationId,
        },
        vibrate: [200, 100, 200],
        actions: [
          {
            action: 'open',
            title: 'View Details',
          },
          {
            action: 'close',
            title: 'Dismiss',
          },
        ],
      };

      return self.registration.showNotification(title, options);
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const rawUrl = (event.notification.data && event.notification.data.url) || '/';
  const targetUrl = new URL(rawUrl, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and navigate
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.focus().then((focused) => {
            if (focused && 'navigate' in focused) {
              return focused.navigate(targetUrl);
            }
          });
        }
      }

      // If no window is open, open a new window to targetUrl
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

