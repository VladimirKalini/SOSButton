/**
 * Push Helper - Вспомогательный скрипт для работы с Web Push уведомлениями
 * Этот скрипт помогает настроить push-уведомления на мобильных устройствах
 */

(function() {
  'use strict';
  
  // Определяем платформу пользователя
  const getPlatform = () => {
    const userAgent = navigator.userAgent || '';
    
    if (/android/i.test(userAgent)) {
      return 'android';
    }
    
    if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
      return 'ios';
    }
    
    return 'web';
  };
  
  // Текущая платформа
  const platform = getPlatform();
  console.log(`[Push Helper] Определена платформа: ${platform}`);
  
  // Функция для конвертации base64 в Uint8Array (для applicationServerKey)
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
  
  // Функция для проверки и запроса разрешений на уведомления
  async function checkNotificationPermission() {
    if (!('Notification' in window)) {
      console.warn('[Push Helper] Браузер не поддерживает уведомления');
      return false;
    }
    
    if (Notification.permission === 'granted') {
      console.log('[Push Helper] Разрешение на уведомления уже получено');
      return true;
    }
    
    if (Notification.permission === 'denied') {
      console.warn('[Push Helper] Разрешение на уведомления отклонено пользователем');
      return false;
    }
    
    // Запрашиваем разрешение
    console.log('[Push Helper] Запрашиваем разрешение на уведомления');
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      console.log('[Push Helper] Разрешение на уведомления получено');
      return true;
    } else {
      console.warn('[Push Helper] Разрешение на уведомления не получено:', permission);
      return false;
    }
  }
  
  // Функция для регистрации push-подписки
  async function registerPushSubscription() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('[Push Helper] Push уведомления не поддерживаются браузером');
      return null;
    }
    
    try {
      // Проверяем разрешение на уведомления
      const hasPermission = await checkNotificationPermission();
      if (!hasPermission) {
        return null;
      }
      
      // Получаем регистрацию service worker
      const registration = await navigator.serviceWorker.ready;
      console.log('[Push Helper] Service Worker готов:', registration);
      
      // Проверяем наличие существующей подписки
      let subscription = await registration.pushManager.getSubscription();
      
      // Если подписка существует, возвращаем её
      if (subscription) {
        console.log('[Push Helper] Найдена существующая push-подписка');
        return subscription;
      }
      
      // Получаем VAPID ключ
      const vapidMeta = document.querySelector('meta[name="vapid-key"]');
      if (!vapidMeta) {
        console.error('[Push Helper] Не найден мета-тег с VAPID ключом');
        return null;
      }
      
      const vapidKey = vapidMeta.content;
      if (!vapidKey) {
        console.error('[Push Helper] VAPID ключ пустой');
        return null;
      }
      
      // Создаем новую подписку
      console.log('[Push Helper] Создаем новую push-подписку');
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey)
      });
      
      console.log('[Push Helper] Push-подписка создана:', subscription);
      return subscription;
    } catch (error) {
      console.error('[Push Helper] Ошибка при регистрации push-подписки:', error);
      return null;
    }
  }
  
  // Функция для отправки подписки на сервер
  async function sendSubscriptionToServer(subscription, role) {
    if (!subscription) {
      console.warn('[Push Helper] Нет подписки для отправки на сервер');
      return false;
    }
    
    try {
      const response = await fetch('/api/save-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subscription,
          role
        })
      });
      
      if (!response.ok) {
        throw new Error(`Сервер вернул статус ${response.status}`);
      }
      
      const data = await response.json();
      console.log('[Push Helper] Подписка успешно отправлена на сервер:', data);
      return true;
    } catch (error) {
      console.error('[Push Helper] Ошибка при отправке подписки на сервер:', error);
      
      // Повторная попытка через 5 секунд
      console.log('[Push Helper] Повторная попытка через 5 секунд');
      setTimeout(() => {
        sendSubscriptionToServer(subscription, role)
          .catch(err => console.error('[Push Helper] Повторная попытка не удалась:', err));
      }, 5000);
      
      return false;
    }
  }
  
  // Функция для отправки тестового уведомления
  async function sendTestNotification() {
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
      console.warn('[Push Helper] Service Worker не активен, невозможно отправить тестовое уведомление');
      return;
    }
    
    console.log('[Push Helper] Отправка тестового уведомления');
    navigator.serviceWorker.controller.postMessage({
      action: 'send-test-notification',
      platform: platform
    });
  }
  
  // Основная функция инициализации
  async function init() {
    // Проверяем, является ли устройство мобильным
    const isMobile = platform === 'android' || platform === 'ios';
    
    // Для мобильных устройств делаем дополнительные настройки
    if (isMobile) {
      console.log('[Push Helper] Мобильное устройство обнаружено, настраиваем push-уведомления');
      
      // Регистрируем подписку
      const subscription = await registerPushSubscription();
      
      // Если подписка создана, отправляем на сервер
      if (subscription) {
        // Получаем роль пользователя из localStorage
        const role = localStorage.getItem('userRole') || 'user';
        
        // Отправляем подписку на сервер
        await sendSubscriptionToServer(subscription, role);
        
        // Отправляем тестовое уведомление через 2 секунды
        setTimeout(sendTestNotification, 2000);
      }
    }
    
    // Добавляем обработчик сообщений от service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', event => {
        const { action, data } = event.data || {};
        console.log('[Push Helper] Получено сообщение от Service Worker:', action);
        
        if (action === 'notification-clicked') {
          // Обработка клика по уведомлению
          console.log('[Push Helper] Клик по уведомлению:', data);
          
          // Фокусируем окно
          window.focus();
          
          // Если есть ID вызова, перенаправляем на страницу вызова
          if (data && data.sosId) {
            window.location.href = `/call/${data.sosId}`;
          }
        }
      });
    }
  }
  
  // Запускаем инициализацию после полной загрузки страницы
  window.addEventListener('load', init);
})(); 