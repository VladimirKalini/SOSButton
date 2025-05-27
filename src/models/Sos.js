// src/models/Sos.js
const mongoose = require('mongoose');

const sosSchema = new mongoose.Schema({
  phone:     String,
  latitude:  Number,
  longitude: Number,
  offer:     Object,
  sosId:     String,
  status:    { type: String, default: 'active' },
  videoPath: String,
  recordingStarted: { type: Boolean, default: false },
  expireAt: { 
    type: Date, 
    default: function() {
      // Автоматическое удаление через 2 дня
      const date = new Date();
      date.setDate(date.getDate() + 2);
      return date;
    },
    index: { expires: 0 } // TTL индекс для автоматического удаления
  }
}, { timestamps: true });

module.exports = mongoose.model('Sos', sosSchema);
