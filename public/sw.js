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
  '/siren.mp3',
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

// Аудио-плеер для воспроизведения сирены
let audioPlayer = null;

// Обработка push-уведомлений
self.addEventListener('push', event => {
  console.log('Получено push-уведомление:', event.data ? event.data.text() : 'Нет данных');
  
  let data;
  try {
    data = event.data.json();
  } catch (e) {
    data = {
      title: 'SOS Сигнал',
      body: 'Получен экстренный вызов',
      data: {
        url: '/',
        fullScreenIntent: true,
        soundName: 'siren.mp3'
      }
    };
  }
  
  console.log('Данные push-уведомления:', data);
  
  const options = {
    body: data.body || 'SOS вызов! Требуется подтверждение.',
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
      fullScreenIntent: true,
      soundName: 'siren.mp3',
      callData: data.callData || {}
    }
  };

  // Для Android добавляем полноэкранное намерение
  if (data.data && data.data.fullScreenIntent) {
    options.data.fullScreenIntent = true;
  }

  // Показываем уведомление
  event.waitUntil(
    self.registration.showNotification(data.title || 'SOS Сигнал', options)
      .then(() => {
        // Воспроизводим звук сирены
        if (!audioPlayer) {
          audioPlayer = new Audio('/siren.mp3');
          audioPlayer.loop = true;
        }
        return audioPlayer.play();
      })
      .catch(err => console.error('Ошибка показа уведомления:', err))
      .then(() => {
        // Если возможно, открываем окно приложения с полноэкранным оверлеем
        return self.clients.matchAll({ type: 'window' }).then(clientList => {
          // Если есть открытое окно, отправляем сообщение для показа оверлея
          for (const client of clientList) {
            if (client.url.includes(self.registration.scope)) {
              client.postMessage({ 
                action: 'show-sos-overlay', 
                data: data.callData || {} 
              });
              return;
            }
          }
          
          // Если нет открытого окна, открываем новое
          if (self.clients.openWindow) {
            return self.clients.openWindow(data.url || '/');
          }
        });
      })
  );
});

// Обработка клика по уведомлению
self.addEventListener('notificationclick', event => {
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};
  
  // Закрываем уведомление
  notification.close();
  
  // Останавливаем звук сирены
  if (audioPlayer) {
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
    audioPlayer = null;
  }
  
  // Обрабатываем действия
  if (action === 'accept') {
    // Открываем окно с вызовом
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then(clientList => {
        // Если есть открытое окно, фокусируемся на нем
        for (const client of clientList) {
          if (client.url.includes(self.registration.scope) && 'focus' in client) {
            client.postMessage({ action: 'accept-sos', data: data });
            return client.focus();
          }
        }
        
        // Если нет открытого окна, открываем новое
        if (self.clients.openWindow) {
          return self.clients.openWindow(data.url || '/');
        }
      })
    );
  } else if (action === 'decline') {
    // Отправляем сообщение об отклонении вызова
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then(clientList => {
        for (const client of clientList) {
          if (client.url.includes(self.registration.scope)) {
            client.postMessage({ action: 'decline-sos', data: data });
          }
        }
      })
    );
  } else {
    // Просто открываем приложение при клике по уведомлению и показываем оверлей
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then(clientList => {
        for (const client of clientList) {
          if (client.url.includes(self.registration.scope) && 'focus' in client) {
            client.postMessage({ action: 'show-sos-overlay', data: data });
            return client.focus();
          }
        }
        
        if (self.clients.openWindow) {
          return self.clients.openWindow(data.url || '/');
        }
      })
    );
  }
});

// Обработка закрытия уведомления
self.addEventListener('notificationclose', event => {
  // Останавливаем звук сирены
  if (audioPlayer) {
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
    audioPlayer = null;
  }
});

// Обработка сообщений от клиентов
self.addEventListener('message', event => {
  const { action, data } = event.data || {};
  
  if (action === 'stop-siren') {
    // Останавливаем звук сирены
    if (audioPlayer) {
      audioPlayer.pause();
      audioPlayer.currentTime = 0;
      audioPlayer = null;
    }
  }
  
  // Обработка запроса на отправку тестового push-уведомления
  if (action === 'send-test-notification') {
    self.registration.showNotification('Тестовое уведомление', {
      body: 'Проверка работы уведомлений',
      icon: '/logo192.png',
      vibrate: [200, 100, 200],
      badge: '/logo192.png',
      tag: 'test-notification'
    });
  }
});
