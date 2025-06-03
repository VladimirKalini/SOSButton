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
  '/icons/sos.png',
  '/static/js/bundle.js',
  '/static/js/main.js',
  '/static/css/main.css'
];

// При установке – закешировать всё и сразу активировать нового SW
self.addEventListener('install', event => {
  console.log('[Service Worker] Установка');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .then(() => console.log('[Service Worker] Установка завершена'))
  );
});

// При активации – удалить старые кеши и взять контроль над клиентами
self.addEventListener('activate', event => {
  console.log('[Service Worker] Активация');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
    .then(() => console.log('[Service Worker] Активация завершена'))
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

// Глобальная переменная для аудио
let audioPlayer = null;

// Обработка push-уведомлений
self.addEventListener('push', event => {
  console.log('[Service Worker] Получено push-уведомление:', event.data ? event.data.text() : 'Нет данных');
  
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
  
  console.log('[Service Worker] Данные push-уведомления:', data);
  
  const options = {
    body: data.body || 'Поступил SOS-вызов',
    icon: '/icons/sos.png',
    badge: '/logo192.png',
    vibrate: [200, 100, 200, 100, 200, 100, 400],
    tag: 'sos-notification',
    requireInteraction: true,
    renotify: true,
    silent: false,
    actions: [
      { action: 'accept', title: 'Принять' },
      { action: 'decline', title: 'Отклонить' }
    ],
    data: {
      url: data.url || '/',
      sosId: data.sosId || null,
      fullScreenIntent: true
    }
  };

  // Для Android добавляем настройки для полноэкранного уведомления
  if ('setAppBadge' in navigator) {
    navigator.setAppBadge(1).catch(err => console.error('Ошибка установки бейджа:', err));
  }

  // Показываем уведомление
  event.waitUntil(
    self.registration.showNotification(data.title || 'Внимание! SOS', options)
      .then(() => {
        console.log('[Service Worker] Уведомление показано');
        
        // Воспроизводим звук сирены
        try {
          if (!audioPlayer) {
            audioPlayer = new Audio('/siren.mp3');
            audioPlayer.loop = true;
          }
          
          audioPlayer.play()
            .then(() => console.log('[Service Worker] Звук сирены запущен'))
            .catch(err => console.error('[Service Worker] Ошибка воспроизведения звука:', err));
        } catch (err) {
          console.error('[Service Worker] Ошибка инициализации аудио:', err);
        }
        
        // Пробуем открыть окно, если приложение закрыто
        return self.clients.matchAll({ type: 'window' })
          .then(clientList => {
            console.log('[Service Worker] Найдено клиентов:', clientList.length);
            
            // Если есть открытое окно, отправляем сообщение для показа оверлея
            if (clientList.length > 0) {
              for (const client of clientList) {
                console.log('[Service Worker] Отправка сообщения клиенту:', client.id);
                client.postMessage({
                  action: 'show-sos-overlay',
                  data: data
                });
              }
              return;
            }
            
            // Если нет открытых окон, пытаемся открыть новое
            console.log('[Service Worker] Нет открытых окон, пытаемся открыть новое');
            return self.clients.openWindow('/')
              .then(client => {
                console.log('[Service Worker] Новое окно открыто:', client ? client.id : 'unknown');
                return client;
              })
              .catch(err => {
                console.error('[Service Worker] Ошибка открытия окна:', err);
              });
          });
      })
      .catch(err => {
        console.error('[Service Worker] Ошибка показа уведомления:', err);
      })
  );
});

// Обработка клика по уведомлению
self.addEventListener('notificationclick', event => {
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};
  
  console.log('[Service Worker] Клик по уведомлению, действие:', action);
  
  // Закрываем уведомление
  notification.close();
  
  // Останавливаем звук сирены
  if (audioPlayer) {
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
    console.log('[Service Worker] Звук сирены остановлен');
  }
  
  // Сбрасываем бейдж
  if ('clearAppBadge' in navigator) {
    navigator.clearAppBadge().catch(err => console.error('Ошибка сброса бейджа:', err));
  }
  
  // Обрабатываем действия
  if (action === 'accept') {
    // Открываем окно с вызовом
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then(clientList => {
        // Если есть открытое окно, фокусируемся на нем
        for (const client of clientList) {
          if ('focus' in client) {
            console.log('[Service Worker] Отправка сообщения accept клиенту:', client.id);
            client.postMessage({ action: 'accept-sos', data: data });
            return client.focus();
          }
        }
        
        // Если нет открытого окна, открываем новое
        console.log('[Service Worker] Открываем новое окно для принятия вызова');
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
          console.log('[Service Worker] Отправка сообщения decline клиенту:', client.id);
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
            console.log('[Service Worker] Отправка сообщения show-sos-overlay клиенту:', client.id);
            client.postMessage({ action: 'show-sos-overlay', data: data });
            return client.focus();
          }
        }
        
        console.log('[Service Worker] Открываем новое окно при клике по уведомлению');
        if (self.clients.openWindow) {
          return self.clients.openWindow('/');
        }
      })
    );
  }
});

// Обработка закрытия уведомления
self.addEventListener('notificationclose', event => {
  console.log('[Service Worker] Уведомление закрыто');
  
  // Останавливаем звук сирены
  if (audioPlayer) {
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
    console.log('[Service Worker] Звук сирены остановлен при закрытии уведомления');
  }
});

// Обработка сообщений от клиентов
self.addEventListener('message', event => {
  const { action, data } = event.data || {};
  console.log('[Service Worker] Получено сообщение от клиента:', action, data);
  
  if (action === 'stop-siren') {
    // Останавливаем звук сирены
    if (audioPlayer) {
      audioPlayer.pause();
      audioPlayer.currentTime = 0;
      console.log('[Service Worker] Звук сирены остановлен по запросу клиента');
    }
  }
}); 