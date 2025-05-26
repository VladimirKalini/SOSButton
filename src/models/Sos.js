const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  phone:        { type: String, required: true },
  latitude:     { type: Number, required: true },
  longitude:    { type: Number, required: true },
  offer:        { type: Object, required: true },
  createdAt:    { type: Date, default: Date.now }
});
module.exports = mongoose.model('Sos', schema);
