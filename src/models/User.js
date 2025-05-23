// src/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const ROLES = { USER: 'user', MODERATOR: 'moderator' };

const userSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    unique: true,
    match: [/^\+\d{11,15}$/, 'Неправильный формат телефона']
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
