// Импортируем настроенный mongoose
const mongoose = require('../config/mongoose');

// Определяем схемы и модели после настройки mongoose
const User = require('./User');
const Sos = require('./Sos');

// Экспортируем модели
module.exports = {
  User,
  Sos,
  mongoose
}; 