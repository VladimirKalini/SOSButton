// src/routes/calls.js
const express = require('express')
const Sos     = require('../models/Sos')
const router  = express.Router()

router.get('/active', async (req, res) => {
  try {
    const filter = req.user.role === 'guard'
      ? { status: 'active' }
      : { status: 'active', phone: req.user.phone }
    const active = await Sos.find(filter).sort({ createdAt: -1 })
    res.json(active)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
})

router.post('/:id/cancel', async (req, res) => {
  try {
    await Sos.findByIdAndUpdate(req.params.id, { status: 'cancelled' })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
})

router.get('/history', async (req, res) => {
  try {
    const all = await Sos.find().sort({ createdAt: -1 })
    res.json(all)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router
