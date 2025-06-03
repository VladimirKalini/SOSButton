const express = require('express');
const http = require('http');
const path = require('path');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const authRoutes = require('./src/routes/auth');
const callsRoutes = require('./src/routes/calls');
const Sos = require('./src/models/Sos');
const fs = require('fs');
const User = require('./src/models/User');
const webPush = require('web-push');
const vapidKeys = require('./src/config/vapidKeys');

// Настройка Web Push
webPush.setVapidDetails(
  'mailto:admin@1fxpro.vip',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// Создание директории для загрузки видео
const uploadsDir = path.join(__dirname, 'uploads/videos');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Создана директория для загрузки видео:', uploadsDir);
}

// Создание директории для логов
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
  console.log('Создана директория для логов:', logsDir);
}

// Функция для логирования с временной меткой
function logWithTime(message) {
  const now = new Date().toISOString();
  const logMessage = `[${now}] ${message}`;
  console.log(logMessage);
  
  // Запись в файл логов
  const logFile = path.join(logsDir, `app-${new Date().toISOString().split('T')[0]}.log`);
  fs.appendFileSync(logFile, logMessage + '\n');
}

// Подключение к MongoDB
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/sos-app';
mongoose
  .connect(mongoUri)
  .then(() => logWithTime('MongoDB connected'))
  .catch(err => {
    logWithTime(`MongoDB connection error: ${err.message}`);
    process.exit(1);
  });

// Создаем схему и модель для подписок на push-уведомления
const pushSubscriptionSchema = new mongoose.Schema({
  subscription: Object,
  role: { type: String, enum: ['user', 'guard'], default: 'user' },
  createdAt: { type: Date, default: Date.now }
});

const PushSubscription = mongoose.model('PushSubscription', pushSubscriptionSchema);

// Создание Express приложения и HTTP сервера
const app = express();
const httpServer = http.createServer(app);

// Настройка Socket.IO с увеличенными таймаутами
const io = new Server(httpServer, { 
  cors: { origin: '*' },
  pingTimeout: 120000, // Увеличиваем таймаут пинга до 2 минут
  pingInterval: 25000, // Интервал пинга 25 секунд
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 5e6, // 5MB максимальный размер сообщения
  connectTimeout: 45000 // Увеличиваем таймаут соединения до 45 секунд
});

// Сохраняем экземпляр io для использования в маршрутах
app.set('io', io);

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/api', authRoutes);
app.use('/api/calls', callsRoutes);

// Добавляем маршрут для проверки статуса сервера
app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    webpush: {
      subscriptions: {
        total: 0, // Будет обновлено после запроса к БД
        guards: 0
      }
    }
  });
  
  // Асинхронно обновляем статистику подписок
  PushSubscription.countDocuments()
    .then(total => {
      return PushSubscription.countDocuments({ role: 'guard' })
        .then(guards => {
          logWithTime(`Всего подписок: ${total}, охранников: ${guards}`);
        });
    })
    .catch(err => logWithTime(`Ошибка подсчета подписок: ${err.message}`));
});

// Маршрут для сохранения push-подписки
app.post('/api/save-subscription', async (req, res) => {
  try {
    const { subscription, role } = req.body;
    
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Некорректные данные подписки' });
    }
    
    // Проверяем, существует ли уже такая подписка
    const existingSubscription = await PushSubscription.findOne({
      'subscription.endpoint': subscription.endpoint
    });
    
    if (existingSubscription) {
      // Обновляем существующую подписку
      existingSubscription.subscription = subscription;
      existingSubscription.role = role || existingSubscription.role;
      await existingSubscription.save();
      logWithTime(`Обновлена push-подписка для ${role}`);
      return res.status(200).json({ message: 'Подписка обновлена' });
    } else {
      // Создаем новую подписку
      const newSubscription = new PushSubscription({
        subscription,
        role: role || 'user'
      });
      await newSubscription.save();
      logWithTime(`Создана новая push-подписка для ${role}`);
      return res.status(201).json({ message: 'Подписка создана' });
    }
  } catch (err) {
    logWithTime(`Ошибка сохранения push-подписки: ${err.message}`);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Функция для отправки push-уведомлений охране
async function sendPushToGuards(payload = {}) {
  try {
    // Получаем все подписки охранников
    const guardSubscriptions = await PushSubscription.find({ role: 'guard' });
    logWithTime(`Найдено ${guardSubscriptions.length} подписок охранников для отправки push`);
    
    if (guardSubscriptions.length === 0) {
      logWithTime('Нет подписок охранников для отправки push-уведомлений');
      return;
    }
    
    // Формируем данные уведомления
    const notificationPayload = JSON.stringify({
      title: payload.title || 'Внимание! SOS',
      body: payload.body || 'Поступил SOS-вызов',
      icon: '/icons/sos.png',
      sosId: payload.sosId,
      url: payload.url || '/'
    });
    
    // Отправляем уведомления всем охранникам
    const sendPromises = guardSubscriptions.map(sub => {
      return webPush.sendNotification(sub.subscription, notificationPayload)
        .catch(err => {
          logWithTime(`Ошибка отправки push-уведомления: ${err.message}`);
          
          // Если подписка недействительна, удаляем её
          if (err.statusCode === 404 || err.statusCode === 410) {
            return PushSubscription.deleteOne({ _id: sub._id });
          }
        });
    });
    
    await Promise.all(sendPromises);
    logWithTime('Push-уведомления отправлены охранникам');
  } catch (err) {
    logWithTime(`Ошибка при отправке push-уведомлений: ${err.message}`);
  }
}

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
  socket.on('sos-offer', async ({ latitude, longitude, phone, reconnect, sosId: existingSosId }) => {
    try {
      logWithTime(`Получен SOS от ${phone}`);
      
      // Если это переподключение существующего вызова
      if (reconnect && existingSosId) {
        logWithTime(`Переподключение для существующего SOS ${existingSosId}`);
        
        // Находим существующий вызов
        const existingSos = await Sos.findOne({ sosId: existingSosId });
        if (existingSos) {
          // Присоединяем клиента к комнате с ID вызова
          socket.join(existingSosId);
          
          // Оповещаем охрану о переподключении
          socket.to('guard').emit('sos-reconnect', {
            id: existingSosId
          });
          
          // Отправляем подтверждение клиенту
          socket.emit('sos-saved', { id: existingSosId });
          logWithTime(`Переподключение SOS ${existingSosId} обработано`);
          
          // Отправляем push-уведомления охране
          await sendPushToGuards({
            title: 'Внимание! SOS',
            body: `Переподключение SOS-вызова от ${existingSos.userName || phone}`,
            sosId: existingSosId
          });
          
          return;
        } else {
          logWithTime(`Существующий SOS ${existingSosId} не найден, создаем новый`);
        }
      }
      
      // Находим пользователя по номеру телефона для получения имени
      const user = await User.findOne({ phone });
      const userName = user ? user.name : 'Неизвестный пользователь';
      
      // Создание нового SOS вызова
      const doc = new Sos({ phone, userName, latitude, longitude });
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
        latitude,
        longitude,
        phone,
        userName,
        id: doc.sosId,
        createdAt: doc.createdAt
      });
      
      logWithTime(`Оповещение о новом SOS отправлено охране: ${userName} (${phone}), ID: ${doc.sosId}`);
      
      // Отправляем push-уведомления охране
      await sendPushToGuards({
        title: 'Внимание! SOS',
        body: `Поступил SOS-вызов от ${userName || phone}`,
        sosId: doc.sosId
      });
    } catch (err) {
      logWithTime(`Ошибка при обработке SOS: ${err.message}`);
      socket.emit('error', { message: 'Не удалось сохранить SOS сигнал' });
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
  
  // Периодическая проверка состояния соединения
  const pingInterval = setInterval(() => {
    if (socket.connected) {
      socket.emit('ping');
    } else {
      clearInterval(pingInterval);
    }
  }, 30000);
  
  socket.on('pong', () => {
    // Клиент ответил на пинг, соединение активно
  });
});

// Запуск сервера
const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, '0.0.0.0', () => {
  logWithTime(`Сервер запущен на 0.0.0.0:${PORT}`);
});

