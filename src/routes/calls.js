// src/routes/calls.js
const express = require('express');
const Sos     = require('../models/Sos');
const router  = express.Router();

// 1) Активные SOS
router.get('/active', async (req, res) => {
  try {
    const active = await Sos.find({ status: 'active' }).sort({ createdAt: -1 });
    res.json(active);
  } catch (err) {
    console.error('GET /api/calls/active error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// 2) Отменить SOS (frontend делает POST)
router.post('/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    await Sos.findByIdAndUpdate(id, { status: 'cancelled' });
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/calls/:id/cancel error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// 3) История всех SOS (если понадобится для отдельного экрана)
router.get('/history', async (req, res) => {
  try {
    const all = await Sos.find().sort({ createdAt: -1 });
    res.json(all);
  } catch (err) {
    console.error('GET /api/calls/history error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
