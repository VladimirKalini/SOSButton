// server.js (в корне вашего проекта)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const authRoutes = require('./routes/auth');

const app = express();
const httpServer = http.createServer(app);

// 1) Парсинг JSON для API
app.use(express.json());

// 2) Маршруты API (регистрация, логин и т.д.)
app.use('/api', authRoutes);

// 3) Статика React
app.use(express.static(path.join(__dirname, 'build')));

// 4) SPA-роутинг: без параметров внутри path-to-regexp
app.get('/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// 5) Socket.IO для видеопотоков SOS
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

io.use((socket, next) => {
  // TODO: проверка socket.handshake.auth.token
  next();
});

io.on('connection', socket => {
  socket.on('join-room', room => socket.join(room));

  socket.on('sos-offer', ({ offer, latitude, longitude, phone, id }) => {
    socket.to('moderators').emit('incoming-sos', { offer, latitude, longitude, phone, id });
  });

  socket.on('ice-candidate', ({ candidate, id }) => {
    socket.to(id).emit('ice-candidate', candidate);
  });
});

// 6) Запуск сервера
const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
