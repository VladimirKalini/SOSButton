// service-worker.js - обработчик push-уведомлений

const CACHE_NAME = 'sos-app-cache-v4';
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
  '/icons/sos.svg',
  '/icons/sos.png',
  '/push-helper.js',
  '/static/js/bundle.js',
  '/static/js/main.js',
  '/static/css/main.css'
];

// Обработчик события установки
self.addEventListener('install', event => {
  console.log('[Service Worker] Установка');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .then(() => console.log('[Service Worker] Установка завершена'))
  );
});

// Обработчик события активации
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

// Обработчик события fetch - стратегия stale-while-revalidate
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

// Определяем платформу пользователя
function getPlatform() {
  const userAgent = self.navigator?.userAgent || '';
  
  if (/android/i.test(userAgent)) {
    return 'android';
  }
  
  if (/iPad|iPhone|iPod/.test(userAgent) && !self.MSStream) {
    return 'ios';
  }
  
  return 'web';
}

// Функция для создания звука сирены с помощью Web Audio API
async function createSirenSound() {
  try {
    if (!audioPlayer) {
      audioPlayer = new Audio('/siren.mp3');
      audioPlayer.loop = true;
    }
    
    try {
      await audioPlayer.play();
      console.log('[Service Worker] Сирена воспроизводится');
      return true;
    } catch (err) {
      console.error('[Service Worker] Ошибка воспроизведения сирены:', err);
      return false;
    }
  } catch (err) {
    console.error('[Service Worker] Ошибка создания сирены:', err);
    return false;
  }
}

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
  
  // Определяем платформу
  const platform = getPlatform();
  console.log('[Service Worker] Платформа:', platform);
  
  // Базовые настройки уведомления
  const options = {
    body: data.body || 'Поступил SOS-вызов',
    icon: '/icons/sos.svg',
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
      fullScreenIntent: true,
      timestamp: Date.now(),
      platform: platform
    }
  };

  // Специфичные настройки для Android
  if (platform === 'android') {
    options.priority = 'high';
    options.importance = 'high';
    options.channelId = 'sos_channel';
    options.visibility = 'public';
    options.sound = '/siren.mp3';
    options.vibrate = [300, 100, 300, 100, 300, 100, 300];
  }
  
  // Специфичные настройки для iOS
  if (platform === 'ios') {
    options.sound = 'default';
    options.data.contentAvailable = 1;
    options.data.mutableContent = 1;
    options.data.categoryId = 'sos';
  }

  // Устанавливаем бейдж для поддерживаемых платформ
  if ('setAppBadge' in navigator) {
    navigator.setAppBadge(1).catch(err => console.error('Ошибка установки бейджа:', err));
  }

  // Показываем уведомление
  event.waitUntil(
    self.registration.showNotification(data.title || 'Внимание! SOS', options)
      .then(() => {
        console.log('[Service Worker] Уведомление показано');
        
        // Воспроизводим звук сирены
        createSirenSound()
          .then(success => {
            if (!success) {
              console.warn('[Service Worker] Не удалось воспроизвести сирену автоматически');
            }
          });
        
        // Вибрируем на мобильных устройствах
        if ('vibrate' in navigator) {
          try {
            navigator.vibrate([300, 100, 300, 100, 300]);
            console.log('[Service Worker] Вибрация активирована');
          } catch (err) {
            console.error('[Service Worker] Ошибка активации вибрации:', err);
          }
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
                  data: data,
                  platform: platform
                });
              }
              return;
            }
            
            // Если нет открытых окон, пытаемся открыть новое
            console.log('[Service Worker] Нет открытых окон, пытаемся открыть новое');
            return self.clients.openWindow('/')
              .then(client => {
                console.log('[Service Worker] Новое окно открыто:', client ? client.id : 'unknown');
                
                // Даем время на загрузку страницы и отправляем сообщение
                if (client) {
                  setTimeout(() => {
                    client.postMessage({
                      action: 'show-sos-overlay',
                      data: data,
                      platform: platform
                    });
                  }, 2000);
                }
                
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
        const url = data.sosId ? `/call/${data.sosId}` : '/';
        
        return self.clients.openWindow(url)
          .then(client => {
            if (client) {
              // Даем время на загрузку страницы
              setTimeout(() => {
                client.postMessage({ action: 'accept-sos', data: data });
              }, 1000);
            }
            return client;
          });
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
        
        // Если нет открытых окон, открываем новое для отклонения
        if (clientList.length === 0) {
          return self.clients.openWindow('/')
            .then(client => {
              if (client) {
                // Даем время на загрузку страницы
                setTimeout(() => {
                  client.postMessage({ action: 'decline-sos', data: data });
                }, 1000);
              }
              return client;
            });
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
        return self.clients.openWindow('/')
          .then(client => {
            if (client) {
              // Даем время на загрузку страницы
              setTimeout(() => {
                client.postMessage({ action: 'show-sos-overlay', data: data });
              }, 1000);
            }
            return client;
          });
      })
    );
  }
  
  // Отправляем сообщение всем клиентам о клике по уведомлению
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        action: 'notification-clicked',
        data: data
      });
    });
  });
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
  const { action, data, platform } = event.data || {};
  console.log('[Service Worker] Получено сообщение от клиента:', action, data);
  
  if (action === 'stop-siren') {
    // Останавливаем звук сирены
    if (audioPlayer) {
      audioPlayer.pause();
      audioPlayer.currentTime = 0;
      console.log('[Service Worker] Звук сирены остановлен по запросу клиента');
    }
    
    // Отправляем подтверждение клиенту
    if (event.source) {
      event.source.postMessage({
        action: 'siren-stopped',
        success: true
      });
    }
    
    // Закрываем все уведомления с тегом sos-notification
    self.registration.getNotifications({ tag: 'sos-notification' })
      .then(notifications => {
        notifications.forEach(notification => {
          notification.close();
          console.log('[Service Worker] Закрыто уведомление по запросу клиента');
        });
      })
      .catch(err => {
        console.error('[Service Worker] Ошибка при закрытии уведомлений:', err);
      });
      
    // Сбрасываем бейдж
    if ('clearAppBadge' in navigator) {
      navigator.clearAppBadge().catch(err => console.error('Ошибка сброса бейджа:', err));
    }
  } else if (action === 'send-test-notification') {
    // Отправляем тестовое уведомление
    const clientPlatform = platform || getPlatform();
    console.log('[Service Worker] Отправка тестового уведомления для платформы:', clientPlatform);
    
    const options = {
      body: 'Система уведомлений работает корректно',
      icon: '/icons/sos.svg',
      badge: '/logo192.png',
      tag: 'test-notification',
      vibrate: [100, 50, 100],
      data: {
        platform: clientPlatform,
        test: true,
        timestamp: Date.now()
      }
    };
    
    // Специфичные настройки для Android
    if (clientPlatform === 'android') {
      options.priority = 'high';
      options.channelId = 'sos_channel';
    }
    
    // Специфичные настройки для iOS
    if (clientPlatform === 'ios') {
      options.data.contentAvailable = 1;
      options.data.mutableContent = 1;
    }
    
    // Показываем тестовое уведомление
    self.registration.showNotification('Тестовое уведомление', options)
      .then(() => {
        console.log('[Service Worker] Тестовое уведомление отправлено');
        
        // Вибрируем на мобильных устройствах
        if ('vibrate' in navigator && (clientPlatform === 'android' || clientPlatform === 'ios')) {
          try {
            navigator.vibrate([100, 50, 100]);
          } catch (err) {
            console.error('[Service Worker] Ошибка активации вибрации:', err);
          }
        }
      })
      .catch(err => console.error('[Service Worker] Ошибка отправки тестового уведомления:', err));
  } else if (action === 'SKIP_WAITING') {
    // Принудительная активация нового service worker
    self.skipWaiting();
    console.log('[Service Worker] Принудительная активация');
  } else if (action === 'INIT_NOTIFICATION_CHANNEL') {
    // Для будущей поддержки каналов уведомлений
    console.log('[Service Worker] Инициализация канала уведомлений:', data);
  } else if (action === 'check-push-support') {
    // Отправляем ответ о поддержке push-уведомлений
    const client = event.source;
    if (client) {
      client.postMessage({
        action: 'push-support-result',
        supported: 'PushManager' in self,
        platform: getPlatform()
      });
    }
  }
});

// Обработчик события sync для отложенных действий
self.addEventListener('sync', event => {
  console.log('[Service Worker] Получено событие sync:', event.tag);
  
  if (event.tag === 'sync-subscriptions') {
    console.log('[Service Worker] Синхронизация подписок');
    // Здесь можно добавить логику синхронизации подписок
  }
});

// Показываем тестовое уведомление
if ('Notification' in window && Notification.permission === 'granted') {
  const testNotification = new Notification('Тестовое уведомление', {
    body: 'Система уведомлений работает корректно',
    icon: '/icons/sos.svg'
  });
} 