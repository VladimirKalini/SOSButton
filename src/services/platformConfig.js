/**
 * Модуль для определения платформы и настройки специфичных параметров
 */

/**
 * Определяет платформу пользователя на основе User-Agent
 * @returns {'android'|'ios'|'web'} Тип платформы
 */
export function getPlatform() {
  const userAgent = navigator.userAgent || '';
  
  if (/android/i.test(userAgent)) {
    return 'android';
  }
  
  if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
    return 'ios';
  }
  
  return 'web';
}

/**
 * Проверяет, является ли устройство мобильным
 * @returns {boolean} true если устройство мобильное
 */
export function isMobileDevice() {
  const platform = getPlatform();
  return platform === 'android' || platform === 'ios';
}

/**
 * Получает специфичные настройки для платформы
 * @param {string} platform - Тип платформы
 * @returns {Object} Объект с настройками
 */
export function getPlatformConfig(platform = null) {
  const currentPlatform = platform || getPlatform();
  
  // Базовые настройки для всех платформ
  const config = {
    notificationOptions: {
      requireInteraction: true,
      vibrate: [200, 100, 200, 100, 200],
      renotify: true
    },
    pushOptions: {
      userVisibleOnly: true
    }
  };
  
  // Специфичные настройки для Android
  if (currentPlatform === 'android') {
    config.notificationOptions = {
      ...config.notificationOptions,
      vibrate: [300, 100, 300, 100, 300, 100, 300],
      priority: 'high',
      importance: 'high',
      channelId: 'sos_channel',
      visibility: 'public',
      sound: '/siren.mp3'
    };
  }
  
  // Специфичные настройки для iOS
  if (currentPlatform === 'ios') {
    config.notificationOptions = {
      ...config.notificationOptions,
      sound: 'default',
      data: {
        contentAvailable: 1,
        mutableContent: 1,
        categoryId: 'sos'
      }
    };
  }
  
  return config;
}

/**
 * Проверяет поддержку push-уведомлений в браузере
 * @returns {Promise<boolean>} Promise с результатом проверки
 */
export async function checkPushSupport() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }
  
  try {
    // Проверяем регистрацию service worker
    const registration = await navigator.serviceWorker.ready;
    
    // Проверяем разрешение на уведомления
    if (Notification.permission !== 'granted') {
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('Ошибка проверки поддержки push:', err);
    return false;
  }
}

/**
 * Запрашивает разрешение на показ уведомлений
 * @returns {Promise<boolean>} Promise с результатом запроса
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.warn('Браузер не поддерживает уведомления');
    return false;
  }
  
  if (Notification.permission === 'granted') {
    return true;
  }
  
  if (Notification.permission === 'denied') {
    console.warn('Разрешение на уведомления отклонено пользователем');
    return false;
  }
  
  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (err) {
    console.error('Ошибка запроса разрешения на уведомления:', err);
    return false;
  }
}

export default {
  getPlatform,
  isMobileDevice,
  getPlatformConfig,
  checkPushSupport,
  requestNotificationPermission
}; 