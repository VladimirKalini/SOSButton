// src/routes/auth.js
const express = require('express');
const Joi = require('joi');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

const registerSchema = Joi.object({
  phone: Joi.string().pattern(/^\+\d{11,15}$/).required(),
  password: Joi.string().min(6).required()
});

const loginSchema = Joi.object({
  phone: Joi.string().pattern(/^\+\d{11,15}$/).required(),
  password: Joi.string().required()
});

router.post('/register', async (req, res) => {
  const { error, value } = registerSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { phone, password } = value;
  if (await User.findOne({ phone })) {
    return res.status(409).json({ message: 'Этот номер уже зарегистрирован' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await new User({ phone, passwordHash }).save();
  res.status(201).json({ message: 'Пользователь зарегистрирован' });
});

router.post('/login', async (req, res) => {
  const { error, value } = loginSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { phone, password } = value;
  const user = await User.findOne({ phone }).select('+passwordHash');
  if (!user) {
    return res.status(401).json({ message: 'Неверный номер или пароль' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ message: 'Неверный номер или пароль' });
  }

  const token = jwt.sign(
    { userId: user._id, phone: user.phone, role: user.role },
    process.env.JWT_SECRET || 'very_secret_key',
    { expiresIn: '7d' }
  );

  res.json({
    token,
    user: { id: user._id, phone: user.phone, role: user.role }
  });
});

module.exports = router;
