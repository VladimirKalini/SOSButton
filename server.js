// server.js
require('debug').disable();

const express    = require('express');
const http       = require('http');
const path       = require('path');
const mongoose   = require('mongoose');
const { Server } = require('socket.io');

const authRoutes  = require('./src/routes/auth');
const callsRoutes = require('./src/routes/calls');
const Sos         = require('./src/models/Sos');

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/sos-app';
mongoose
  .connect(mongoUri)
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

const app        = express();
const httpServer = http.createServer(app);
const io         = new Server(httpServer, { cors: { origin: '*' } });

// Делаем io доступным в маршрутах через app.get('io')
app.set('io', io);

// Middleware
app.use(express.json());
app.use('/api', authRoutes);
app.use('/api/calls', callsRoutes);

// Сборка React-приложения
app.use(express.static(path.join(__dirname, 'build')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use((req, res, next) => {
  if (
    req.method === 'GET' &&
    !req.path.startsWith('/api') &&
    !req.path.startsWith('/socket.io') &&
    !req.path.includes('.')
  ) {
    return res.sendFile(path.join(__dirname, 'build', 'index.html'));
  }
  next();
});

// Socket.IO
io.on('connection', socket => {
  // Пользователь или модератор присоединяется к своей комнате
  socket.on('join-room', room => socket.join(room));

  // Новый SOS-запрос
  socket.on('sos-offer', async ({ offer, latitude, longitude, phone, id }) => {
    // Сохраняем запрос в БД
    const doc = new Sos({ phone, latitude, longitude, offer, sosId: id });
    await doc.save();

    // Сообщаем клиенту ID сохранённого документа
    socket.emit('sos-saved', { id: doc._id });

    // Посылаем оффер модераторам
    socket.to('moderators').emit('incoming-sos', {
      offer,
      latitude,
      longitude,
      phone,
      id: doc._id
    });
  });

  // ICE-кандидат от клиента или модератора
  socket.on('ice-candidate', ({ candidate, id }) => {
    socket.to(id).emit('ice-candidate', candidate);
  });
});

// Запуск сервера
const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on 0.0.0.0:${PORT}`);
});
