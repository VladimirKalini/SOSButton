// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const authRoutes = require('./src/routes/auth');  // Подключаем маршруты аутентификации

const app = express();
const httpServer = http.createServer(app);

// Middleware для парсинга JSON в теле запросов
app.use(express.json());

// Маршруты API (регистрация, логин и т.д.)
app.use('/api', authRoutes);

// Раздаём статические файлы React
app.use(express.static(path.join(__dirname, 'build')));

// SPA-роутинг: все не-API-запросы отдаём index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Socket.IO
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

// Middleware для проверки JWT при WebSocket
io.use((socket, next) => {
  // TODO: проверить socket.handshake.auth.token
  next();
});

io.on('connection', socket => {
  // Присоединяем модератора в комнату
  socket.on('join-room', room => {
    socket.join(room);
  });

  // Пользователь нажал SOS
  socket.on('sos-offer', ({ offer, latitude, longitude, phone }) => {
    socket.to('moderators').emit('incoming-sos', { offer, latitude, longitude, phone });
  });

  // Обмен ICE-кандидатами
  socket.on('ice-candidate', ({ candidate, id }) => {
    socket.to(id).emit('ice-candidate', candidate);
  });
});

// Запуск сервера
const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
