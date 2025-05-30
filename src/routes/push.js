/**
 * Маршруты для работы с push-уведомлениями на клиенте
 */
import { Router } from 'express';
import authMiddleware from '../middleware/auth';
import PushSubscription from '../models/PushSubscription';

const router = Router();

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

    // Проверяем, существует ли уже такая подписка
    let existingSub = await PushSubscription.findOne({
      userId,
      'subscription.endpoint': subscription.endpoint
    });

    if (existingSub) {
      // Обновляем существующую подписку
      existingSub.subscription = subscription;
      existingSub.userAgent = userAgent || existingSub.userAgent;
      existingSub.updatedAt = new Date();
      await existingSub.save();
      return res.status(200).json({ message: 'Подписка обновлена', subscription: existingSub });
    }

    // Создаем новую подписку
    const newSubscription = new PushSubscription({
      userId,
      subscription,
      userAgent: userAgent || 'Unknown'
    });

    await newSubscription.save();
    res.status(201).json({ message: 'Подписка сохранена', subscription: newSubscription });
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

    await PushSubscription.deleteOne({
      userId,
      'subscription.endpoint': subscription.endpoint
    });

    res.status(200).json({ message: 'Подписка удалена' });
  } catch (error) {
    console.error('Ошибка при удалении push-подписки:', error);
    res.status(500).json({ message: 'Ошибка сервера при удалении подписки' });
  }
});

/**
 * Получает VAPID публичный ключ
 * GET /api/push/vapid-public-key
 */
router.get('/vapid-public-key', (req, res) => {
  // Публичный VAPID ключ должен быть доступен клиенту для подписки
  const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BDXFtyQvu34gIH9tJUlN14goQg5DclkVHFBuM1cz7c8AeqvGWKzKx8RkYxqNqbD0KQEaqpG_tm0lgnrhALU';
  res.status(200).json({ publicKey: VAPID_PUBLIC_KEY });
});

export default router; 