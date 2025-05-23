// sw.js

const CACHE_NAME = 'sos-app-cache-v1';
const OFFLINE_URL = '/offline.html';
const ASSETS = [
  '/', 
  '/index.html',
  OFFLINE_URL,
  '/manifest.json',
  '/favicon.ico',
  '/logo192.png',
  '/logo512.png',
  // Основные статические файлы React (замените на реальные имена из build)
  '/static/js/bundle.js',
  '/static/js/main.js',
  '/static/css/main.css'
];

// При установке – закешировать всё и сразу активировать нового SW
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// При активации – удалить старые кеши и взять контроль над клиентами
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Стратегия stale-while-revalidate + оффлайн-заглушка для документов
self.addEventListener('fetch', event => {
  // Обрабатываем только GET-запросы
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(event.request).then(cachedResponse => {
        const networkFetch = fetch(event.request)
          .then(networkResponse => {
            // Обновляем кеш
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          })
          .catch(() => {
            // Если запрос документа упал – возвращаем оффлайн-страницу
            if (event.request.destination === 'document') {
              return cache.match(OFFLINE_URL);
            }
          });

        // Сначала отдаём из кеша (если есть), иначе ждём сеть
        return cachedResponse || networkFetch;
      })
    )
  );
});
