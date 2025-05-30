// src/routes/auth.js
const express = require('express');
const Joi = require('joi');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

const registerSchema = Joi.object({
  phone: Joi.string().pattern(/^\+\d{11,15}$/).required(),
  password: Joi.string().min(6).required(),
  name: Joi.string().required().trim()
});

const loginSchema = Joi.object({
  phone: Joi.string().pattern(/^\+\d{11,15}$/).required(),
  password: Joi.string().required(),
  deviceId: Joi.string().allow(null, '')
});

router.post('/register', async (req, res) => {
  const { error, value } = registerSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { phone, password, name } = value;
  if (await User.findOne({ phone })) {
    return res.status(409).json({ message: 'Этот номер уже зарегистрирован' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await new User({ phone, passwordHash, name }).save();
  res.status(201).json({ message: 'Пользователь зарегистрирован' });
});

router.post('/login', async (req, res) => {
  const { error, value } = loginSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { phone, password, deviceId } = value;
  const user = await User.findOne({ phone }).select('+passwordHash');
  if (!user) {
    return res.status(401).json({ message: 'Неверный номер или пароль' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ message: 'Неверный номер или пароль' });
  }

  // Обновляем deviceId пользователя, если он был передан
  if (deviceId) {
    user.deviceId = deviceId;
    user.lastLogin = new Date();
    await user.save();
  } else if (!user.deviceId) {
    // Если deviceId не передан и не существует, генерируем новый
    const { v4: uuidv4 } = require('uuid');
    user.deviceId = uuidv4();
    user.lastLogin = new Date();
    await user.save();
  }

  // Создаем токен с добавлением deviceId
  const token = jwt.sign(
    { 
      userId: user._id, 
      phone: user.phone, 
      role: user.role, 
      name: user.name,
      deviceId: user.deviceId
    },
    process.env.JWT_SECRET || 'very_secret_key',
    { expiresIn: '30d' } // Увеличиваем срок действия токена до 30 дней
  );

  res.json({
    token,
    user: { 
      id: user._id, 
      phone: user.phone, 
      role: user.role, 
      name: user.name,
      deviceId: user.deviceId
    }
  });
});

// Проверка валидности токена и обновление срока действия
router.post('/refresh-token', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ message: 'Токен не предоставлен' });
    }
    
    // Проверяем токен
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'very_secret_key');
    
    // Находим пользователя
    const user = await User.findById(payload.userId);
    
    if (!user) {
      return res.status(401).json({ message: 'Пользователь не найден' });
    }
    
    // Проверяем, соответствует ли deviceId
    if (payload.deviceId && payload.deviceId !== user.deviceId) {
      return res.status(401).json({ message: 'Недействительный deviceId' });
    }
    
    // Создаем новый токен
    const newToken = jwt.sign(
      { 
        userId: user._id, 
        phone: user.phone, 
        role: user.role, 
        name: user.name,
        deviceId: user.deviceId
      },
      process.env.JWT_SECRET || 'very_secret_key',
      { expiresIn: '30d' }
    );
    
    // Обновляем время последнего входа
    user.lastLogin = new Date();
    await user.save();
    
    res.json({
      token: newToken,
      user: { 
        id: user._id, 
        phone: user.phone, 
        role: user.role, 
        name: user.name,
        deviceId: user.deviceId
      }
    });
  } catch (error) {
    console.error('Ошибка при обновлении токена:', error);
    res.status(401).json({ message: 'Недействительный токен' });
  }
});

module.exports = router;
