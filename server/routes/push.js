// server/routes/push.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const notificationService = require('../services/notificationService');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');

// Получение публичного VAPID ключа
router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: notificationService.VAPID_PUBLIC_KEY });
});

// Подписка на push-уведомления
router.post('/subscribe', authMiddleware, async (req, res) => {
  try {
    const { subscription, userAgent } = req.body;
    const userId = req.user._id;

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ message: 'Некорректные данные подписки' });
    }

    // Генерируем deviceId, если его нет
    let deviceId = req.body.deviceId;
    if (!deviceId) {
      deviceId = uuidv4();
    }

    // Сохраняем deviceId в профиле пользователя
    if (!req.user.deviceId) {
      await User.updateOne({ _id: userId }, { deviceId });
    }

    // Сохраняем подписку
    await notificationService.saveSubscription(userId, subscription, userAgent);

    res.status(201).json({ 
      message: 'Подписка успешно сохранена',
      deviceId
    });
  } catch (error) {
    console.error('Ошибка при сохранении подписки:', error);
    res.status(500).json({ message: 'Ошибка сервера при сохранении подписки' });
  }
});

// Отписка от push-уведомлений
router.post('/unsubscribe', authMiddleware, async (req, res) => {
  try {
    const { subscription } = req.body;
    const userId = req.user._id;

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ message: 'Некорректные данные подписки' });
    }

    // Удаляем подписку
    await notificationService.removeSubscription(userId, subscription);

    res.json({ message: 'Подписка успешно удалена' });
  } catch (error) {
    console.error('Ошибка при удалении подписки:', error);
    res.status(500).json({ message: 'Ошибка сервера при удалении подписки' });
  }
});

// Тестовый маршрут для отправки push-уведомления (только для администраторов)
router.post('/test-notification', authMiddleware, async (req, res) => {
  try {
    // Проверяем, что пользователь - охранник
    if (req.user.role !== 'guard') {
      return res.status(403).json({ message: 'Доступ запрещен' });
    }

    const testData = {
      id: 'test-call-id',
      phone: '+71234567890',
      userName: 'Тестовый пользователь',
      latitude: 55.7558,
      longitude: 37.6173
    };

    // Отправляем тестовое уведомление только текущему пользователю
    const count = await notificationService.sendSOSNotificationToGuards(testData);

    res.json({ 
      message: 'Тестовое уведомление отправлено',
      sentCount: count
    });
  } catch (error) {
    console.error('Ошибка при отправке тестового уведомления:', error);
    res.status(500).json({ message: 'Ошибка сервера при отправке уведомления' });
  }
});

module.exports = router; 