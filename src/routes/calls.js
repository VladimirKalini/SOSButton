// src/routes/calls.js
const express     = require('express')
const Sos         = require('../models/Sos')
const requireAuth = require('../middleware/auth')
const router      = express.Router()

router.use(requireAuth)

router.get('/active', async (req, res) => {
  try {
    const filter = req.user.role === 'guard'
      ? { status: 'active' }
      : { status: 'active', phone: req.user.phone }
    const active = await Sos.find(filter).sort({ createdAt: -1 })
    res.json(active)
  } catch {
    res.status(500).json({ message: 'Server error' })
  }
})

router.post('/:id/cancel', async (req, res) => {
  try {
    const sos = await Sos.findById(req.params.id)
    if (!sos) return res.status(404).end()
    if (req.user.role !== 'guard' && sos.phone !== req.user.phone) {
      return res.status(403).end()
    }
    sos.status = 'cancelled'
    await sos.save()
    res.json({ ok: true })
  } catch {
    res.status(500).json({ message: 'Server error' })
  }
})

router.get('/history', async (req, res) => {
  try {
    const filter = req.user.role === 'guard'
      ? {}
      : { phone: req.user.phone }
    const all = await Sos.find(filter).sort({ createdAt: -1 })
    res.json(all)
  } catch {
    res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router
