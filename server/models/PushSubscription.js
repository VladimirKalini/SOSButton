const mongoose = require('mongoose');

/**
 * Схема для хранения push-подписок пользователей
 */
const pushSubscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subscription: {
    endpoint: {
      type: String,
      required: true
    },
    expirationTime: {
      type: Number,
      default: null
    },
    keys: {
      p256dh: {
        type: String,
        required: true
      },
      auth: {
        type: String,
        required: true
      }
    }
  },
  userAgent: {
    type: String,
    default: 'Unknown'
  },
  deviceId: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Создаем индекс для быстрого поиска по userId и endpoint
pushSubscriptionSchema.index({ userId: 1, 'subscription.endpoint': 1 }, { unique: true });

module.exports = mongoose.model('PushSubscription', pushSubscriptionSchema); 