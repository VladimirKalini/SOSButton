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
  '/icons/sos-icon-192.png',
  '/icons/sos-badge-96.png',
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
  let data;
  try {
    data = event.data.json();
  } catch (e) {
    data = {
      title: 'SOS Сигнал',
      body: 'Получен новый SOS-вызов!',
      data: {
        url: '/',
        soundName: 'siren.mp3'
      }
    };
  }

  const options = {
    body: data.body || 'SOS вызов!',
    icon: data.icon || '/icons/sos-icon-192.png',
    vibrate: data.vibrate || [300, 100, 300],
    badge: data.badge || '/icons/sos-badge-96.png',
    tag: data.tag || 'sos-call',
    requireInteraction: true,
    renotify: true,
    actions: [
      { action: 'accept', title: 'Принять' },
      { action: 'decline', title: 'Отклонить' }
    ],
    data: {
      url: data.data?.url || '/',
      callId: data.data?.callId,
      phone: data.data?.phone,
      userName: data.data?.userName,
      fullScreenIntent: true,
      soundName: data.data?.soundName || 'siren.mp3'
    }
  };

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
            client.postMessage({ 
              action: 'accept-sos', 
              data: {
                callId: data.callId,
                phone: data.phone,
                userName: data.userName
              } 
            });
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
            client.postMessage({ 
              action: 'decline-sos', 
              data: {
                callId: data.callId,
                phone: data.phone,
                userName: data.userName
              } 
            });
          }
        }
      })
    );
  } else {
    // Просто открываем приложение при клике по уведомлению
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then(clientList => {
        for (const client of clientList) {
          if (client.url.includes(self.registration.scope) && 'focus' in client) {
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
