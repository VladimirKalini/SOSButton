// src/routes/calls.js
const express = require('express');
const Sos = require('../models/Sos');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

// Получить активные вызовы (только охрана)
router.get('/active', roleMiddleware('guard'), async (req, res) => {
  try {
    const calls = await Sos.find({ status: 'active' }).sort('-createdAt');
    res.json(calls);
  } catch (err) {
    console.error('Ошибка при получении активных вызовов:', err);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Получить детали конкретного вызова (только охрана)
router.get('/:id', roleMiddleware('guard'), async (req, res) => {
  try {
    const sos = await Sos.findById(req.params.id);
    if (!sos) {
      return res.status(404).json({ message: 'SOS-вызов не найден' });
    }
    res.json(sos);
  } catch (err) {
    console.error('Ошибка при получении деталей вызова:', err);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Отменить свой сигнал (пользователь)
router.delete('/:id', async (req, res) => {
  try {
    const sos = await Sos.findById(req.params.id);
    if (!sos) {
      return res.status(404).json({ message: 'Сигнал не найден' });
    }
    if (sos.phone !== req.user.phone) {
      return res.status(403).json({ message: 'Нельзя отменить чужой сигнал' });
    }
    sos.status = 'cancelled';
    await sos.save();
    req.app.get('io').to(sos.sosId).emit('sos-canceled', { id: sos._id });
    res.json(sos);
  } catch (err) {
    console.error('Ошибка при отмене сигнала:', err);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Отменить любой сигнал (охрана)
router.delete('/:id/cancel', roleMiddleware('guard'), async (req, res) => {
  try {
    const sos = await Sos.findById(req.params.id);
    if (!sos) {
      return res.status(404).json({ message: 'SOS-вызов не найден' });
    }
    sos.status = 'cancelled';
    await sos.save();
    req.app.get('io').to(sos.sosId).emit('sos-canceled', { id: sos._id });
    res.json(sos);
  } catch (err) {
    console.error('Ошибка при отмене вызова:', err);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// История вызовов (только охрана) с пагинацией
router.get('/history', roleMiddleware('guard'), async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const calls = await Sos.find()
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit);
    res.json(calls);
  } catch (err) {
    console.error('Ошибка при получении истории вызовов:', err);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

module.exports = router;
