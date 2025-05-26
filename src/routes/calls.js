// src/routes/calls.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const Sos = require('../models/Sos');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.resolve(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.params.id}${ext}`);
  }
});
const upload = multer({ storage });

router.use(authMiddleware);

router.get('/active', roleMiddleware('moderator'), async (req, res) => {
  const calls = await Sos.find({ canceled: false }).sort('-createdAt');
  res.json(calls);
});

router.post('/:id/cancel', roleMiddleware('moderator'), async (req, res) => {
  const sos = await Sos.findByIdAndUpdate(
    req.params.id,
    { canceled: true },
    { new: true }
  );
  if (!sos) return res.status(404).json({ message: 'SOS-вызов не найден' });
  req.app.get('io').to(sos.sosId).emit('sos-canceled');
  res.json(sos);
});

router.get('/history', roleMiddleware('moderator'), async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const calls = await Sos.find()
    .sort('-createdAt')
    .skip((page - 1) * limit)
    .limit(limit);
  res.json(calls);
});

router.post('/:id/video', roleMiddleware('user'), upload.single('video'), async (req, res) => {
  const videoPath = `/uploads/${req.file.filename}`;
  const sos = await Sos.findByIdAndUpdate(
    req.params.id,
    { videoPath },
    { new: true }
  );
  if (!sos) return res.status(404).json({ message: 'SOS-вызов не найден' });
  res.json({ message: 'Видео сохранено', videoPath });
});

module.exports = router;
