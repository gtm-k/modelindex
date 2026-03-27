// ModelIndex Service Worker — offline caching
const CACHE_NAME = 'modelindex-v3';
const STATIC_ASSETS = [
  './',
  './index.html',
  './js/db.js',
  './js/factors.js',
  './js/presets.js',
  './js/mcs.js',
  './js/sensitivity.js',
  './js/domain-schemas.js',
  './data/baseline.json',
  './data/baseline-robotics.json',
  './data/baseline-weather.json',
  './data/baseline-materials.json',
  './data/registry.json',
  './data/license-compat.json',
  './data/hardware.json',
  './data/tokenizer-ratios.json',
  './manifest.json',
];

const DATA_CACHE = 'modelindex-data-v3';

// Install — cache static assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate — clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => k !== CACHE_NAME && k !== DATA_CACHE)
        .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch — network-first for data, cache-first for static
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Score data files: network-first, fallback to cache
  if (url.pathname.includes('/data/scores/')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(DATA_CACHE).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Static assets: cache-first, fallback to network
  e.respondWith(
    caches.match(e.request)
      .then(cached => cached || fetch(e.request))
  );
});
