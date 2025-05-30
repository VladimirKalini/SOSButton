const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');
const User = require('../models/User');

// VAPID ключи для отправки push-уведомлений
// В реальном проекте эти ключи должны храниться в переменных окружения
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BLGrBJeuBk3XEjU9lX_fKNTv_TU_XxZnRgPRnM8RQmBjr-5NPRg-JlGKsQpVJIgXVBcZYVMHhCuCnr1XZT5Macs';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'YOUR_PRIVATE_KEY_HERE';
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@example.com';

// Настраиваем VAPID ключи
webpush.setVapidDetails(
  VAPID_EMAIL,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

/**
 * Инициализирует сервис уведомлений
 */
function init() {
  console.log('Сервис уведомлений инициализирован');
  
  // Проверяем наличие VAPID ключей
  if (VAPID_PRIVATE_KEY === 'YOUR_PRIVATE_KEY_HERE') {
    console.warn('ВНИМАНИЕ: Используются тестовые VAPID ключи. Для продакшена сгенерируйте новые ключи с помощью команды: npm run generate-vapid');
  }
}

/**
 * Сохраняет push-подписку пользователя в базе данных
 * @param {string} userId ID пользователя
 * @param {object} subscription Объект подписки от браузера
 * @param {string} userAgent User-Agent браузера
 * @returns {Promise<object>} Сохраненная подписка
 */
async function saveSubscription(userId, subscription, userAgent) {
  try {
    // Проверяем, существует ли уже такая подписка
    let existingSub = await PushSubscription.findOne({
      userId,
      'subscription.endpoint': subscription.endpoint
    });

    if (existingSub) {
      // Обновляем существующую подписку
      existingSub.subscription = subscription;
      existingSub.userAgent = userAgent;
      existingSub.updatedAt = new Date();
      await existingSub.save();
      return existingSub;
    }

    // Создаем новую подписку
    const newSubscription = new PushSubscription({
      userId,
      subscription,
      userAgent
    });

    await newSubscription.save();
    return newSubscription;
  } catch (error) {
    console.error('Ошибка при сохранении push-подписки:', error);
    throw error;
  }
}

/**
 * Удаляет push-подписку пользователя из базы данных
 * @param {string} userId ID пользователя
 * @param {object} subscription Объект подписки от браузера
 * @returns {Promise<boolean>} Результат удаления
 */
async function removeSubscription(userId, subscription) {
  try {
    await PushSubscription.deleteOne({
      userId,
      'subscription.endpoint': subscription.endpoint
    });
    return true;
  } catch (error) {
    console.error('Ошибка при удалении push-подписки:', error);
    throw error;
  }
}

/**
 * Отправляет push-уведомление о новом SOS-вызове всем охранникам
 * @param {object} sosData Данные о SOS-вызове
 * @returns {Promise<number>} Количество отправленных уведомлений
 */
async function sendSOSNotificationToGuards(sosData) {
  try {
    // Находим всех охранников
    const guards = await User.find({ role: 'guard' });
    
    if (!guards || guards.length === 0) {
      console.log('Нет доступных охранников для отправки уведомлений');
      return 0;
    }
    
    // Получаем ID всех охранников
    const guardIds = guards.map(guard => guard._id.toString());
    
    // Находим все подписки охранников
    const subscriptions = await PushSubscription.find({
      userId: { $in: guardIds }
    });
    
    if (!subscriptions || subscriptions.length === 0) {
      console.log('Нет активных push-подписок для охранников');
      return 0;
    }
    
    console.log(`Отправка push-уведомлений ${subscriptions.length} охранникам`);
    
    // Формируем данные для уведомления
    const notificationPayload = {
      title: 'SOS-вызов!',
      body: `Новый вызов от ${sosData.userName || 'пользователя'} (${sosData.phone})`,
      icon: '/icons/sos-icon-192.png',
      badge: '/icons/sos-badge-96.png',
      tag: 'sos-call',
      data: {
        url: `/guard/call/${sosData.id || sosData._id}`,
        callId: sosData.id || sosData._id,
        phone: sosData.phone,
        userName: sosData.userName,
        fullScreenIntent: true,
        soundName: 'siren.mp3'
      },
      actions: [
        {
          action: 'accept',
          title: 'Принять'
        },
        {
          action: 'decline',
          title: 'Отклонить'
        }
      ],
      requireInteraction: true,
      vibrate: [300, 100, 300]
    };
    
    // Отправляем уведомления всем подписчикам
    const sendPromises = subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          subscription.subscription,
          JSON.stringify(notificationPayload)
        );
        return true;
      } catch (error) {
        console.error(`Ошибка отправки push-уведомления: ${error.message}`);
        
        // Если подписка недействительна, удаляем ее
        if (error.statusCode === 410) {
          await PushSubscription.deleteOne({ _id: subscription._id });
          console.log(`Удалена недействительная подписка: ${subscription._id}`);
        }
        return false;
      }
    });
    
    // Ждем завершения всех отправок
    const results = await Promise.all(sendPromises);
    const sentCount = results.filter(result => result).length;
    
    console.log(`Успешно отправлено ${sentCount} из ${subscriptions.length} push-уведомлений`);
    return sentCount;
  } catch (error) {
    console.error('Ошибка при отправке push-уведомлений:', error);
    return 0;
  }
}

module.exports = {
  init,
  saveSubscription,
  removeSubscription,
  sendSOSNotificationToGuards,
  VAPID_PUBLIC_KEY
}; 