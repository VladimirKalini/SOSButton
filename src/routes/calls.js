
// src/routes/calls.js
const express = require('express');
const Sos = require('../models/Sos');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

// Получить активные вызовы (только охрана)
router.get('/active', roleMiddleware('guard'), async (req, res) => {
  const calls = await Sos.find({ status: 'active' }).sort('-createdAt');
  res.json(calls);
});

// Отменить свой сигнал (пользователь)
router.delete('/:id', async (req, res) => {
  const sos = await Sos.findById(req.params.id);
  if (!sos) return res.status(404).json({ message: 'Сигнал не найден' });
  if (sos.phone !== req.user.phone) return res.status(403).json({ message: 'Нельзя отменить чужой сигнал' });
  sos.status = 'cancelled';
  await sos.save();
  req.app.get('io').to(sos.sosId).emit('sos-canceled', { id: sos._id });
  res.json(sos);
});

// Отменить любой сигнал (охрана)
router.delete('/:id/cancel', roleMiddleware('guard'), async (req, res) => {
  const sos = await Sos.findById(req.params.id);
  if (!sos) return res.status(404).json({ message: 'SOS-вызов не найден' });
  sos.status = 'cancelled';
  await sos.save();
  req.app.get('io').to(sos.sosId).emit('sos-canceled', { id: sos._id });
  res.json(sos);
});

// История вызовов (только охрана) с пагинацией
router.get('/history', roleMiddleware('guard'), async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 50;
  const calls = await Sos.find()
    .sort('-createdAt')
    .skip((page - 1) * limit)
    .limit(limit);
  res.json(calls);
});

module.exports = router;
