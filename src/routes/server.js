const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const httpServer = http.createServer(app);

// Отдаём собранные файлы React
app.use(express.static(path.join(__dirname, 'build')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Socket.io
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

io.use((socket, next) => {
  // Проверка JWT, определение роли user/moderator
  next();
});

io.on('connection', socket => {
  // Пользователь нажал SOS
  socket.on('sos-offer', async ({ offer, latitude, longitude, phone }) => {
    // Логируем
    socket.to('moderators').emit('incoming-sos', { offer, latitude, longitude, phone });
  });

  // Обмен ICE-кандидатами
  socket.on('ice-candidate', candidate => {
    socket.to(/* peer-id */).emit('ice-candidate', candidate);
  });
});

// Запуск сервера
const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
