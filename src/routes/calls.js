// src/routes/calls.js
const express = require('express')
const Sos     = require('../models/Sos')
const router  = express.Router()

// для всех /api/calls/* сначала middleware аутентификации
// в server.js: app.use('/api/calls', requireAuth, callsRoutes)

router.get('/active', async (req, res) => {
  try {
    // если guard — все активные, иначе только свои
    const filter = req.user.role === 'guard'
      ? { status: 'active' }
      : { status: 'active', phone: req.user.phone }
    const active = await Sos.find(filter).sort({ createdAt: -1 })
    res.json(active)
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})

router.post('/:id/cancel', async (req, res) => {
  try {
    const sos = await Sos.findById(req.params.id)
    if (!sos) return res.status(404).end()
    // guard может отменять всё, обычный — только свой own
    if (req.user.role !== 'guard' && sos.phone !== req.user.phone) {
      return res.status(403).end()
    }
    sos.status = 'cancelled'
    await sos.save()
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})

router.get('/history', async (req, res) => {
  try {
    // guard видит всё, пользователь — только свои
    const filter = req.user.role === 'guard'
      ? {}
      : { phone: req.user.phone }
    const all = await Sos.find(filter).sort({ createdAt: -1 })
    res.json(all)
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router
