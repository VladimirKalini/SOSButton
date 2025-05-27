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
  pingTimeout: 60000,
  transports: ['websocket', 'polling']
});

// Сохраняем экземпляр io для использования в маршрутах
app.set('io', io);

// Middleware
app.use(express.json({ limit: '50mb' }));
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

// Отслеживание активных соединений
const activeConnections = new Map();

// Обработка Socket.IO соединений
io.on('connection', socket => {
  const token = socket.handshake.auth.token;
  if (!token) {
    console.log('Соединение отклонено: отсутствует токен');
    return socket.disconnect();
  }

  console.log(`Новое соединение: ${socket.id}`);
  
  // Присоединение к комнате
  socket.on('join-room', room => {
    socket.join(room);
    console.log(`Socket ${socket.id} присоединился к комнате: ${room}`);
    
    // Если это комната guard, добавляем в список активных охранников
    if (room === 'guard') {
      activeConnections.set(socket.id, { type: 'guard', socketId: socket.id });
    } else {
      // Проверяем, является ли комната ID вызова SOS
      Sos.findOne({ sosId: room }).then(sos => {
        if (sos) {
          activeConnections.set(socket.id, { 
            type: 'client', 
            sosId: room, 
            socketId: socket.id 
          });
          console.log(`Клиент ${socket.id} присоединился к SOS вызову ${room}`);
        }
      }).catch(err => {
        console.error('Ошибка при проверке SOS ID:', err);
      });
    }
  });

  // Обработка SOS сигнала
  socket.on('sos-offer', async ({ offer, latitude, longitude, phone }) => {
    try {
      console.log(`Получен SOS offer от ${phone}`);
      
      // Создание нового SOS вызова
      const doc = new Sos({ phone, latitude, longitude, offer });
      await doc.save();
      doc.sosId = doc._id.toString();
      await doc.save();
      
      // Отправка подтверждения клиенту
      socket.emit('sos-saved', { id: doc.sosId });
      console.log(`SOS сохранен с ID: ${doc.sosId}, отправлено подтверждение клиенту`);
      
      // Присоединяем клиента к комнате с ID вызова
      socket.join(doc.sosId);
      
      // Добавляем в список активных соединений
      activeConnections.set(socket.id, { 
        type: 'client', 
        sosId: doc.sosId, 
        socketId: socket.id 
      });
      
      // Оповещение охраны о новом вызове
      socket.to('guard').emit('incoming-sos', {
        offer,
        latitude,
        longitude,
        phone,
        id: doc.sosId,
        createdAt: doc.createdAt
      });
      
      console.log(`Оповещение о новом SOS отправлено охране: ${phone}, ID: ${doc.sosId}`);
    } catch (err) {
      console.error('Ошибка при обработке SOS offer:', err);
      socket.emit('error', { message: 'Не удалось сохранить SOS сигнал' });
    }
  });

  // Обработка ответа на SOS
  socket.on('sos-answer', ({ answer, id }) => {
    console.log(`Получен ответ на SOS ${id}`);
    
    // Отправляем ответ в комнату с ID вызова
    socket.to(id).emit('sos-answer', { answer });
    
    // Обновляем информацию о соединении
    if (activeConnections.has(socket.id)) {
      const connection = activeConnections.get(socket.id);
      connection.sosId = id;
      activeConnections.set(socket.id, connection);
    }
    
    console.log(`Ответ отправлен клиенту SOS ${id}`);
  });

  // Обработка ICE кандидатов
  socket.on('ice-candidate', ({ candidate, id }) => {
    console.log(`Получен ICE кандидат для ${id}`);
    socket.to(id).emit('ice-candidate', candidate);
    console.log(`ICE кандидат отправлен для ${id}`);
  });

  // Обработка отключения
  socket.on('disconnect', () => {
    console.log(`Socket ${socket.id} отключен`);
    
    // Удаляем из списка активных соединений
    if (activeConnections.has(socket.id)) {
      const connection = activeConnections.get(socket.id);
      activeConnections.delete(socket.id);
      
      // Если это был клиент, уведомляем охрану
      if (connection.type === 'client' && connection.sosId) {
        console.log(`Клиент SOS ${connection.sosId} отключился`);
      }
    }
  });
});

// Запуск сервера
const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Сервер запущен на 0.0.0.0:${PORT}`);
});

