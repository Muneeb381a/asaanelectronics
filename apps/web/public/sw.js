// Assaan Electronics — Service Worker
// Cache strategy: static assets = cache-first; API = network-first with offline fallback

const SHELL_CACHE = 'assaan-shell-v1';
const API_CACHE   = 'assaan-api-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(['/']))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  const keep = new Set([SHELL_CACHE, API_CACHE]);
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  // API requests: network-first, stale cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req.clone())
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(API_CACHE).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) =>
            cached ?? new Response(
              JSON.stringify({ success: false, data: null, error: 'You are offline' }),
              { status: 503, headers: { 'Content-Type': 'application/json' } }
            )
          )
        )
    );
    return;
  }

  // Navigation requests: network-first, fall back to cached root
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(req, clone));
          return res;
        })
        .catch(() => caches.match('/').then((c) => c ?? caches.match('/index.html')))
    );
    return;
  }

  // Static assets (JS, CSS, images): cache-first (content-hashed filenames are immutable)
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok && res.status < 400) {
          const clone = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(req, clone));
        }
        return res;
      });
    })
  );
});
