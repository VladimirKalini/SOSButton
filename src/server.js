// server.js (в корне вашего проекта)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const authRoutes = require('./routes/auth');


const app = express();
const httpServer = http.createServer(app);

// 1) JSON-парсер для API
app.use(express.json());

// 2) Подключаем API-маршруты
app.use('/api', authRoutes);

// 3) Статика React и SPA-роутинг
app.use(express.static(path.join(__dirname, 'build')));
app.get('*', (req, res) => {
  // Любой путь, не начинающийся с /api, отдадим index.html
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// 4) Socket.IO для видеопотоков SOS
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

// JWT-middleware (пока заглушка)
io.use((socket, next) => {
  // const token = socket.handshake.auth.token;
  // TODO: верифицировать токен, присвоить socket.data.role
  next();
});

io.on('connection', socket => {
  // Модератор заходит в комнату
  socket.on('join-room', room => {
    socket.join(room);
  });

  // Пользователь нажал SOS
  socket.on('sos-offer', ({ offer, latitude, longitude, phone, id }) => {
    // Рассылаем всем в комнате moderators
    socket.to('moderators').emit('incoming-sos', { offer, latitude, longitude, phone, id });
  });

  // ICE-кандидаты от клиента
  socket.on('ice-candidate', ({ candidate, id }) => {
    socket.to(id).emit('ice-candidate', candidate);
  });
});

// 5) Запуск сервера
const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
