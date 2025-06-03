// service-worker.js - обработчик push-уведомлений

const CACHE_NAME = 'sos-app-cache-v2';
const OFFLINE_URL = '/offline.html';
const ASSETS = [
  '/', 
  '/index.html',
  OFFLINE_URL,
  '/manifest.json',
  '/favicon.ico',
  '/logo192.png',
  '/logo512.png',
  '/siren.mp3',
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

// Обработка push-уведомлений
self.addEventListener('push', event => {
  console.log('Получено push-уведомление:', event.data ? event.data.text() : 'Нет данных');
  
  let data;
  try {
    data = event.data.json();
  } catch (e) {
    data = {
      title: 'Внимание! SOS',
      body: 'Поступил SOS-вызов',
      icon: '/icons/sos.png'
    };
  }
  
  console.log('Данные push-уведомления:', data);
  
  const options = {
    body: data.body || 'Поступил SOS-вызов',
    icon: '/logo192.png',
    vibrate: [200, 100, 200, 100, 200, 100, 400],
    badge: '/logo192.png',
    tag: 'sos-notification',
    requireInteraction: true,
    renotify: true,
    actions: [
      { action: 'accept', title: 'Принять' },
      { action: 'decline', title: 'Отклонить' }
    ],
    data: {
      url: data.url || '/',
      sosId: data.sosId || null
    }
  };

  // Показываем уведомление
  event.waitUntil(
    self.registration.showNotification(data.title || 'Внимание! SOS', options)
      .then(() => {
        // Воспроизводим звук сирены
        playSound('/siren.mp3');
        
        // Если возможно, открываем окно приложения
        return self.clients.matchAll({ type: 'window' }).then(clientList => {
          if (clientList.length === 0 && self.clients.openWindow) {
            return self.clients.openWindow('/');
          }
        });
      })
  );
});

// Функция для воспроизведения звука
function playSound(url) {
  return new Promise((resolve, reject) => {
    const audio = new Audio(url);
    audio.loop = true;
    audio.addEventListener('canplaythrough', () => {
      audio.play()
        .then(resolve)
        .catch(reject);
    });
    audio.addEventListener('error', reject);
  });
}

// Обработка клика по уведомлению
self.addEventListener('notificationclick', event => {
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};
  
  // Закрываем уведомление
  notification.close();
  
  // Обрабатываем действия
  if (action === 'accept') {
    // Открываем окно с вызовом
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then(clientList => {
        // Если есть открытое окно, фокусируемся на нем
        for (const client of clientList) {
          if ('focus' in client) {
            client.postMessage({ action: 'accept-sos', data: data });
            return client.focus();
          }
        }
        
        // Если нет открытого окна, открываем новое
        if (self.clients.openWindow) {
          return self.clients.openWindow(data.sosId ? `/call/${data.sosId}` : '/');
        }
      })
    );
  } else if (action === 'decline') {
    // Отправляем сообщение об отклонении вызова
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then(clientList => {
        for (const client of clientList) {
          client.postMessage({ action: 'decline-sos', data: data });
        }
      })
    );
  } else {
    // Просто открываем приложение при клике по уведомлению
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then(clientList => {
        for (const client of clientList) {
          if ('focus' in client) {
            client.postMessage({ action: 'show-sos-overlay', data: data });
            return client.focus();
          }
        }
        
        if (self.clients.openWindow) {
          return self.clients.openWindow('/');
        }
      })
    );
  }
}); 