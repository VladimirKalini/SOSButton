// src/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Исправлено: роль 'moderator' переименована в 'guard' для единообразия
const ROLES = { USER: 'user', GUARD: 'guard' };

const userSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    unique: true,
    match: [/^\+\d{12}$/, 'Телефон должен содержать ровно 12 цифр и начинаться с +']
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  passwordHash: {
    type: String,
    required: true,
    select: false
  },
  role: {
    type: String,
    enum: Object.values(ROLES),
    default: ROLES.USER
  }
}, {
  timestamps: true
});

// Сравнение пароля
userSchema.methods.comparePassword = function(plainPassword) {
  return bcrypt.compare(plainPassword, this.passwordHash);
};

// Убираем скрытые поля при сериализации
userSchema.method('toJSON', function() {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
});

module.exports = mongoose.model('User', userSchema);