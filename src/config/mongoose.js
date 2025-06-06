const mongoose = require('mongoose');

// Настройка strictQuery для устранения предупреждений
mongoose.set('strictQuery', false);

// Экспортируем настроенный mongoose
module.exports = mongoose; 