const express = require('express');
const http = require('http');
const path = require('path');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const authRoutes = require('./src/routes/auth');
const callsRoutes = require('./src/routes/calls');
const Sos = require('./src/models/Sos');
const fs = require('fs');

// Создание директории для загрузки видео
const uploadsDir = path.join(__dirname, 'uploads/videos');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Создана директория для загрузки видео:', uploadsDir);
}

// Подключение к MongoDB
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/sos-app';
mongoose
  .connect(mongoUri)
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

// Создание Express приложения и HTTP сервера
const app = express();
const httpServer = http.createServer(app);

// Настройка Socket.IO
const io = new Server(httpServer, { 
  cors: { origin: '*' },
  pingTimeout: 60000
});

// Сохраняем экземпляр io для использования в маршрутах
app.set('io', io);

// Middleware
app.use(express.json());
app.use('/api', authRoutes);
app.use('/api/calls', callsRoutes);

// Статические файлы
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'build')));

// Обработка маршрутов React
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

// Обработка Socket.IO соединений
io.on('connection', socket => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return socket.disconnect();
  }

  // Присоединение к комнате
  socket.on('join-room', room => {
    socket.join(room);
    console.log(`Socket ${socket.id} joined room: ${room}`);
  });

  // Обработка SOS сигнала
  socket.on('sos-offer', async ({ offer, latitude, longitude, phone }) => {
    try {
      // Создание нового SOS вызова
      const doc = new Sos({ phone, latitude, longitude, offer });
      await doc.save();
      doc.sosId = doc._id.toString();
      await doc.save();
      
      // Отправка подтверждения клиенту
      socket.emit('sos-saved', { id: doc.sosId });
      
      // Оповещение охраны о новом вызове
      socket.to('guard').emit('incoming-sos', {
        offer,
        latitude,
        longitude,
        phone,
        id: doc.sosId,
        createdAt: doc.createdAt
      });
      
      console.log(`New SOS signal from ${phone}, ID: ${doc.sosId}`);
    } catch (err) {
      console.error('Error processing SOS offer:', err);
      socket.emit('error', { message: 'Не удалось сохранить SOS сигнал' });
    }
  });

  // Обработка ответа на SOS
  socket.on('sos-answer', ({ answer, id }) => {
    socket.to(id).emit('sos-answer', { answer });
    console.log(`Answer sent to SOS ${id}`);
  });

  // Обработка ICE кандидатов
  socket.on('ice-candidate', ({ candidate, id }) => {
    socket.to(id).emit('ice-candidate', candidate);
  });

  // Обработка отключения
  socket.on('disconnect', () => {
    console.log(`Socket ${socket.id} disconnected`);
  });
});

// Запуск сервера
const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on 0.0.0.0:${PORT}`);
});

