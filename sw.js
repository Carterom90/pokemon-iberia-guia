const CACHE_NAME = 'pokemon-iberia-v1';
const SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/';
const TOTAL_POKEMON = 898;

// Core files to cache immediately on install
const CORE_FILES = [
  './index.html',
  './manifest.json',
];

// Install: cache core files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(CORE_FILES);
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first for sprites, network-first for everything else
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Sprite requests: cache-first
  if (url.includes('raw.githubusercontent.com/PokeAPI/sprites')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => new Response('', { status: 404 }));
      })
    );
    return;
  }

  // Everything else: cache-first, fallback to network
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});

// Message: precache all sprites when triggered from the page
self.addEventListener('message', event => {
  if (event.data === 'precache-sprites') {
    precacheSprites();
  }
});

async function precacheSprites() {
  const cache = await caches.open(CACHE_NAME);
  let cached = 0;

  for (let i = 1; i <= TOTAL_POKEMON; i++) {
    const url = `${SPRITE_BASE}${i}.png`;
    const existing = await cache.match(url);
    if (!existing) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          await cache.put(url, response);
          cached++;
        }
      } catch (e) {}
    }
    // Notify progress every 50
    if (i % 50 === 0) {
      self.clients.matchAll().then(clients => {
        clients.forEach(client => client.postMessage({ type: 'sprite-progress', done: i, total: TOTAL_POKEMON }));
      });
    }
  }

  self.clients.matchAll().then(clients => {
    clients.forEach(client => client.postMessage({ type: 'sprite-done', cached }));
  });
}
