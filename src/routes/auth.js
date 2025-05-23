// src/routes/auth.js
const express = require('express');
const Joi = require('joi');
const bcrypt = require('bcrypt');
const User = require('../models/User'); // Mongoose-модель: см. ниже
const router = express.Router();

// 1) Схема валидации Joi
const registerSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^\+\d{11,15}$/) // например, +7xxxxxxxxxx
    .required()
    .messages({
      'string.pattern.base': 'Телефон должен быть в формате +7XXXXXXXXXX',
    }),
  password: Joi.string()
    .min(6)
    .required()
    .messages({
      'string.min': 'Пароль должен содержать минимум 6 символов',
    }),
});

router.post('/register', async (req, res) => {
  // 2) Валидация тела запроса
  const { error, value } = registerSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }
  const { phone, password } = value;

  try {

    const existing = await User.findOne({ phone });
    if (existing) {
      return res.status(409).json({ message: 'Этот номер уже зарегистрирован' });
    }

    
    const saltRounds = 10;
    const hash = await bcrypt.hash(password, saltRounds);


    const user = new User({ phone, passwordHash: hash });
    await user.save();


    return res.status(201).json({ message: 'Пользователь зарегистрирован' });
  } catch (err) {
    console.error('Ошибка в /register:', err);
    return res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
