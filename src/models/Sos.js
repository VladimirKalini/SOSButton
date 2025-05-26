// src/models/Sos.js
const mongoose = require('mongoose');

const sosSchema = new mongoose.Schema({
  phone:     String,
  latitude:  Number,
  longitude: Number,
  offer:     Object,
  sosId:     String,
  status:    { type: String, default: 'active' }
}, { timestamps: true });

module.exports = mongoose.model('Sos', sosSchema);
