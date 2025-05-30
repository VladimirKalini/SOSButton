/**
 * Сервис для работы с Push-уведомлениями
 */

// Проверяем поддержку Push API в браузере
export const isPushSupported = () => {
  return 'serviceWorker' in navigator && 'PushManager' in window;
};

// Преобразование base64 строки в Uint8Array для работы с ключами
const urlBase64ToUint8Array = (base64String) => {
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
};

// Публичный VAPID ключ (заменить на реальный после генерации)
const publicVapidKey = 'BDXFtyQvu34gIH9tJUlN14goQg5DclkVHFBuM1cz7c8AeqvGWKzKx8RkYxqNqbD0KQEaqpG_tm0lgnrhALU';

/**
 * Регистрирует сервис-воркер и подписывается на push-уведомления
 * @returns {Promise<PushSubscription|null>} Объект подписки или null в случае ошибки
 */
export const subscribeToPushNotifications = async () => {
  try {
    if (!isPushSupported()) {
      console.warn('Push-уведомления не поддерживаются в этом браузере');
      return null;
    }

    // Регистрируем сервис-воркер
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('Service Worker зарегистрирован:', registration);

    // Получаем текущую подписку
    let subscription = await registration.pushManager.getSubscription();

    // Если подписки нет, создаем новую
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
      });
      console.log('Создана новая Push-подписка:', subscription);
    } else {
      console.log('Уже есть активная Push-подписка:', subscription);
    }

    // Отправляем подписку на сервер
    await sendSubscriptionToServer(subscription);

    return subscription;
  } catch (error) {
    console.error('Ошибка при подписке на push-уведомления:', error);
    return null;
  }
};

/**
 * Отправляет данные подписки на сервер
 * @param {PushSubscription} subscription Объект подписки
 * @returns {Promise<boolean>} Результат отправки
 */
export const sendSubscriptionToServer = async (subscription) => {
  try {
    const token = localStorage.getItem('jwtToken');
    if (!token) {
      console.error('Нет токена авторизации для отправки подписки');
      return false;
    }

    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        subscription,
        userAgent: navigator.userAgent
      })
    });

    if (!response.ok) {
      throw new Error(`Ошибка при отправке подписки: ${response.status}`);
    }

    console.log('Подписка успешно отправлена на сервер');
    return true;
  } catch (error) {
    console.error('Не удалось отправить подписку на сервер:', error);
    return false;
  }
};

/**
 * Отписывается от push-уведомлений
 * @returns {Promise<boolean>} Результат отписки
 */
export const unsubscribeFromPushNotifications = async () => {
  try {
    if (!isPushSupported()) {
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      return true; // Уже отписан
    }

    // Отправляем запрос на удаление подписки с сервера
    const token = localStorage.getItem('jwtToken');
    if (token) {
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ subscription })
      });
    }

    // Отменяем подписку на стороне клиента
    await subscription.unsubscribe();
    console.log('Успешно отписан от push-уведомлений');
    return true;
  } catch (error) {
    console.error('Ошибка при отписке от push-уведомлений:', error);
    return false;
  }
}; 