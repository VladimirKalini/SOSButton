const CACHE_NAME = 'sos-app-cache-v1';
const ASSETS = [
  '/', 
  '/index.html',
  '/static/js/bundle.js',
  // ...другие файлы, которые хотите закешировать
];

self.addEventListener('install', event => {
  // Во время установки — сразу закешировать нужные файлы
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', event => {
  // При каждом сетевом запросе сначала пытаемся взять из кэша
  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request))
  );
});
