/**
 * Service Worker для обработки push-уведомлений и кэширования
 */

// Имя кэша для оффлайн-доступа
const CACHE_NAME = 'sos-button-cache-v1';

// Ресурсы для предварительного кэширования
const urlsToCache = [
  '/',
  '/index.html',
  '/static/js/main.bundle.js',
  '/static/css/main.css',
  '/manifest.json',
  '/icons/sos-icon-192.png',
  '/icons/sos-icon-512.png',
  '/icons/sos-badge-96.png',
  '/siren.mp3'
];

// Установка Service Worker
self.addEventListener('install', (event) => {
  console.log('Service Worker: Установка');
  
  // Предварительное кэширование ресурсов
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Кэширование файлов');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Активация Service Worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Активация');
  
  // Удаление старых кэшей
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Удаление старого кэша', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Обработка запросов
self.addEventListener('fetch', (event) => {
  // Стратегия "Network first, then cache"
  event.respondWith(
    fetch(event.request)
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

// Обработка push-уведомлений
self.addEventListener('push', (event) => {
  console.log('Service Worker: Получено push-уведомление');
  
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      console.error('Не удалось распарсить данные уведомления:', e);
      data = {
        title: 'Новое уведомление',
        body: event.data.text()
      };
    }
  }
  
  // Настройки уведомления по умолчанию
  const title = data.title || 'SOS-вызов!';
  const options = {
    body: data.body || 'Поступил новый SOS-вызов!',
    icon: data.icon || '/icons/sos-icon-192.png',
    badge: data.badge || '/icons/sos-badge-96.png',
    tag: data.tag || 'sos-call',
    vibrate: data.vibrate || [300, 100, 300, 100, 300],
    data: data.data || {},
    requireInteraction: true,
    actions: data.actions || [
      {
        action: 'accept',
        title: 'Принять'
      },
      {
        action: 'decline',
        title: 'Отклонить'
      }
    ]
  };
  
  // Показываем уведомление
  event.waitUntil(
    self.registration.showNotification(title, options)
      .then(() => {
        // Если в данных есть информация о звуке, воспроизводим его
        if (data.data && data.data.soundName) {
          return playSound(data.data.soundName);
        }
      })
  );
});

// Обработка клика по уведомлению
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Клик по уведомлению', event.action);
  
  // Закрываем уведомление
  event.notification.close();
  
  // Получаем данные из уведомления
  const data = event.notification.data || {};
  let url = '/';
  
  // Определяем URL для открытия в зависимости от действия
  if (event.action === 'accept') {
    // Если нажата кнопка "Принять"
    url = data.url || '/guard/calls';
    
    // Если есть callId, открываем страницу конкретного вызова
    if (data.callId) {
      url = `/guard/call/${data.callId}`;
    }
  } else if (event.action === 'decline') {
    // Если нажата кнопка "Отклонить", просто открываем дашборд
    url = '/guard/dashboard';
  } else {
    // Если просто клик по уведомлению
    url = data.url || '/';
  }
  
  // Открываем или фокусируем окно с нужным URL
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((windowClients) => {
      // Проверяем, есть ли уже открытое окно с нашим приложением
      for (let client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // Если есть, фокусируемся на нем и навигируем на нужный URL
          return client.focus().then(() => {
            if (client.url !== url) {
              return client.navigate(url);
            }
          });
        }
      }
      
      // Если нет открытого окна, открываем новое
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Обработка закрытия уведомления
self.addEventListener('notificationclose', (event) => {
  console.log('Service Worker: Уведомление закрыто');
});

/**
 * Воспроизводит звук в Service Worker через Notification Audio API
 * @param {string} soundName Имя звукового файла
 */
async function playSound(soundName) {
  try {
    // В Service Worker нет доступа к Audio API,
    // поэтому отправляем сообщение всем клиентам для воспроизведения звука
    const clients = await self.clients.matchAll();
    for (const client of clients) {
      client.postMessage({
        type: 'PLAY_SOUND',
        soundName
      });
    }
  } catch (err) {
    console.error('Ошибка при воспроизведении звука:', err);
  }
}
