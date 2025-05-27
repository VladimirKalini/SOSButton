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

// Настройка Socket.IO с увеличенными таймаутами
const io = new Server(httpServer, { 
  cors: { origin: '*' },
  pingTimeout: 120000, // Увеличиваем таймаут пинга до 2 минут
  pingInterval: 25000, // Интервал пинга 25 секунд
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 5e6 // 5MB максимальный размер сообщения
});

// Сохраняем экземпляр io для использования в маршрутах
app.set('io', io);

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
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

// Функция для логирования с временной меткой
function logWithTime(message) {
  const now = new Date().toISOString();
  console.log(`[${now}] ${message}`);
}

// Обработка Socket.IO соединений
io.on('connection', socket => {
  const token = socket.handshake.auth.token;
  if (!token) {
    logWithTime('Соединение отклонено: отсутствует токен');
    return socket.disconnect();
  }

  logWithTime(`Новое соединение: ${socket.id}`);
  
  // Присоединение к комнате
  socket.on('join-room', room => {
    socket.join(room);
    logWithTime(`Socket ${socket.id} присоединился к комнате: ${room}`);
    
    // Если это комната guard, добавляем в список активных охранников
    if (room === 'guard') {
      activeConnections.set(socket.id, { type: 'guard', socketId: socket.id });
      logWithTime(`Охранник ${socket.id} подключился`);
    } else {
      // Проверяем, является ли комната ID вызова SOS
      Sos.findOne({ sosId: room }).then(sos => {
        if (sos) {
          activeConnections.set(socket.id, { 
            type: 'client', 
            sosId: room, 
            socketId: socket.id 
          });
          logWithTime(`Клиент ${socket.id} присоединился к SOS вызову ${room}`);
          
          // Оповещаем всех в комнате о присоединении
          socket.to(room).emit('user-joined', { id: socket.id, type: 'client' });
        }
      }).catch(err => {
        logWithTime(`Ошибка при проверке SOS ID: ${err.message}`);
      });
    }
  });

  // Обработка SOS сигнала
  socket.on('sos-offer', async ({ offer, latitude, longitude, phone }) => {
    try {
      logWithTime(`Получен SOS offer от ${phone}`);
      
      // Создание нового SOS вызова
      const doc = new Sos({ phone, latitude, longitude, offer });
      await doc.save();
      doc.sosId = doc._id.toString();
      await doc.save();
      
      // Отправка подтверждения клиенту
      socket.emit('sos-saved', { id: doc.sosId });
      logWithTime(`SOS сохранен с ID: ${doc.sosId}, отправлено подтверждение клиенту`);
      
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
      
      logWithTime(`Оповещение о новом SOS отправлено охране: ${phone}, ID: ${doc.sosId}`);
    } catch (err) {
      logWithTime(`Ошибка при обработке SOS offer: ${err.message}`);
      socket.emit('error', { message: 'Не удалось сохранить SOS сигнал' });
    }
  });

  // Обработка ответа на SOS
  socket.on('sos-answer', ({ answer, id }) => {
    logWithTime(`Получен ответ на SOS ${id}`);
    
    // Отправляем ответ в комнату с ID вызова
    socket.to(id).emit('sos-answer', { answer });
    
    // Обновляем информацию о соединении
    if (activeConnections.has(socket.id)) {
      const connection = activeConnections.get(socket.id);
      connection.sosId = id;
      activeConnections.set(socket.id, connection);
    }
    
    logWithTime(`Ответ отправлен клиенту SOS ${id}`);
  });

  // Обработка ICE кандидатов
  socket.on('ice-candidate', ({ candidate, id }) => {
    logWithTime(`Получен ICE кандидат для ${id}`);
    
    // Проверяем, существует ли комната
    const room = io.sockets.adapter.rooms.get(id);
    if (room) {
      socket.to(id).emit('ice-candidate', candidate);
      logWithTime(`ICE кандидат отправлен для ${id}, размер комнаты: ${room.size}`);
    } else {
      logWithTime(`Ошибка: комната ${id} не существует`);
      // Создаем комнату, если она не существует
      socket.join(id);
      logWithTime(`Создана новая комната: ${id}`);
    }
  });

  // Обработка отключения
  socket.on('disconnect', () => {
    logWithTime(`Socket ${socket.id} отключен`);
    
    // Удаляем из списка активных соединений
    if (activeConnections.has(socket.id)) {
      const connection = activeConnections.get(socket.id);
      activeConnections.delete(socket.id);
      
      // Если это был клиент, уведомляем охрану
      if (connection.type === 'client' && connection.sosId) {
        logWithTime(`Клиент SOS ${connection.sosId} отключился`);
        socket.to('guard').emit('client-disconnected', { 
          id: connection.sosId,
          socketId: socket.id
        });
      }
    }
  });
  
  // Обработка ошибок
  socket.on('error', (err) => {
    logWithTime(`Ошибка сокета ${socket.id}: ${err.message}`);
  });
});

// Запуск сервера
const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, '0.0.0.0', () => {
  logWithTime(`Сервер запущен на 0.0.0.0:${PORT}`);
});

