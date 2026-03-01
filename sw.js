
const CACHE_NAME = 'deenora-v2-cache-v15';
const CORE_ASSETS = [
  './',
  './index.html',
  './index.tsx',
  './manifest.json',
  './index.css'
];

// On install, cache all core assets immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Caching app shell');
      return cache.addAll(CORE_ASSETS);
    })
  );
  self.skipWaiting();
});

// Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Improved Fetch Strategy: Stale-While-Revalidate for app assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // For external API calls (Supabase), always go network-only
  if (url.hostname.includes('supabase.co') || url.hostname.includes('google.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // For app shell/local assets, use Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Only cache valid successful responses
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // If network fails and no cache, we return a fallback if it's a page navigation
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });

      return cachedResponse || fetchPromise;
    })
  );
});
