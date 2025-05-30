const mongoose = require('mongoose');

const pushSubscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subscription: {
    endpoint: String,
    expirationTime: Number,
    keys: {
      p256dh: String,
      auth: String
    }
  },
  userAgent: String,
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

// Индекс для быстрого поиска по userId
pushSubscriptionSchema.index({ userId: 1 });

// Индекс для быстрого поиска по endpoint
pushSubscriptionSchema.index({ 'subscription.endpoint': 1 });

module.exports = mongoose.model('PushSubscription', pushSubscriptionSchema); 