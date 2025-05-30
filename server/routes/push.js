// server/routes/push.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const notificationService = require('../services/notificationService');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const PushSubscription = require('../models/PushSubscription');
const webpush = require('web-push');

// Получение публичного VAPID ключа
router.get('/vapid-public-key', (req, res) => {
  res.status(200).json({ publicKey: notificationService.VAPID_PUBLIC_KEY });
});

/**
 * Сохраняет push-подписку пользователя
 * POST /api/push/subscribe
 */
router.post('/subscribe', authMiddleware, async (req, res) => {
  try {
    const { subscription, userAgent } = req.body;
    const userId = req.user.id;

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ message: 'Отсутствуют данные подписки' });
    }

    const savedSubscription = await notificationService.saveSubscription(userId, subscription, userAgent);
    res.status(201).json({ message: 'Подписка сохранена', subscription: savedSubscription });
  } catch (error) {
    console.error('Ошибка при сохранении push-подписки:', error);
    res.status(500).json({ message: 'Ошибка сервера при сохранении подписки' });
  }
});

/**
 * Удаляет push-подписку пользователя
 * POST /api/push/unsubscribe
 */
router.post('/unsubscribe', authMiddleware, async (req, res) => {
  try {
    const { subscription } = req.body;
    const userId = req.user.id;

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ message: 'Отсутствуют данные подписки' });
    }

    await notificationService.removeSubscription(userId, subscription);
    res.status(200).json({ message: 'Подписка удалена' });
  } catch (error) {
    console.error('Ошибка при удалении push-подписки:', error);
    res.status(500).json({ message: 'Ошибка сервера при удалении подписки' });
  }
});

/**
 * Тестовый маршрут для отправки push-уведомления
 * POST /api/push/test-notification
 * Только для администраторов
 */
router.post('/test-notification', authMiddleware, async (req, res) => {
  try {
    // Проверяем, что пользователь - администратор
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Доступ запрещен' });
    }

    const { userId, message } = req.body;
    
    if (!userId) {
      return res.status(400).json({ message: 'Не указан ID пользователя' });
    }

    // Находим все подписки пользователя
    const subscriptions = await PushSubscription.find({ userId });
    
    if (!subscriptions || subscriptions.length === 0) {
      return res.status(404).json({ message: 'Подписки не найдены' });
    }

    // Формируем данные для уведомления
    const notificationPayload = {
      title: 'Тестовое уведомление',
      body: message || 'Это тестовое push-уведомление',
      icon: '/icons/sos-icon-192.png',
      badge: '/icons/sos-badge-96.png',
      data: {
        url: '/notifications',
        testMessage: true
      }
    };

    // Отправляем уведомления
    let sentCount = 0;
    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification(
          subscription.subscription,
          JSON.stringify(notificationPayload)
        );
        sentCount++;
      } catch (error) {
        console.error(`Ошибка отправки push-уведомления: ${error.message}`);
        
        // Если подписка недействительна, удаляем ее
        if (error.statusCode === 410) {
          await PushSubscription.deleteOne({ _id: subscription._id });
        }
      }
    }

    res.status(200).json({ 
      message: `Отправлено ${sentCount} из ${subscriptions.length} уведомлений` 
    });
  } catch (error) {
    console.error('Ошибка при отправке тестового уведомления:', error);
    res.status(500).json({ message: 'Ошибка сервера при отправке уведомления' });
  }
});

module.exports = router; 