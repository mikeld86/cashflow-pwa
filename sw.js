// sw.js - App Shell + offline with network-first navigations
// Bump the cache version whenever app shell files change to ensure
// updated resources are fetched rather than old cached ones.
const CACHE_NAME = 'cashflow-cache-v3';
const APP_SHELL = [
  '/',
  '/index.html',
  // Include versioned files to ensure the SW caches the latest versions
  '/styles.css?v=3',
  '/app.js?v=3',
  '/env.js',
  '/manifest.json',
  '/offline.html',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
  '/icons/apple-touch-icon-180.png',
  '/icons/favicon-32.png'
];

const SUPABASE_PREFIXES = [
  'https://api.supabase.com',
  'https://*.supabase.co',
  'https://*.supabase.in'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => k !== CACHE_NAME && caches.delete(k)));
    await self.clients.claim();
  })());
});

function isSupabase(url) {
  return SUPABASE_PREFIXES.some(prefix => {
    if (prefix.includes('*')) {
      const re = new RegExp(prefix.replace(/\*/g, '.*'));
      return re.test(url);
    }
    return url.startsWith(prefix);
  });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try { return await fetch(request); }
      catch (err) {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match('/offline.html')) || new Response('Offline', { status: 503 });
      }
    })());
    return;
  }
  const url = request.url;
  if (isSupabase(url)) return; // never cache Supabase
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    const networkFetch = fetch(request).then((res) => {
      if (res && res.status === 200 && request.method === 'GET') cache.put(request, res.clone());
      return res;
    }).catch(() => cached);
    return cached || networkFetch;
  })());
});