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
  'mailto:admin@novyy-gorizont-sos.com',
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
  userAgent: { type: String, default: '' },
  platform: { type: String, enum: ['web', 'android', 'ios', 'unknown'], default: 'unknown' },
  lastUpdated: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

const PushSubscription = mongoose.model('PushSubscription', pushSubscriptionSchema);

// Создаем схему и модель для FCM токенов
const fcmTokenSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  role: { type: String, enum: ['user', 'guard'], default: 'user' },
  platform: { type: String, enum: ['android', 'ios', 'web', 'unknown'], default: 'unknown' },
  lastUpdated: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

const FCMToken = mongoose.model('FCMToken', fcmTokenSchema);

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
    
    // Получаем User-Agent из заголовков запроса
    const userAgent = req.headers['user-agent'] || '';
    
    // Определяем платформу на основе User-Agent
    let platform = 'unknown';
    if (/android/i.test(userAgent)) {
      platform = 'android';
    } else if (/iPad|iPhone|iPod/.test(userAgent) && !req.headers['x-msstream']) {
      platform = 'ios';
    } else {
      platform = 'web';
    }
    
    logWithTime(`Сохранение подписки для ${role} на платформе ${platform}`);
    
    // Проверяем, существует ли уже такая подписка
    const existingSubscription = await PushSubscription.findOne({
      'subscription.endpoint': subscription.endpoint
    });
    
    if (existingSubscription) {
      // Обновляем существующую подписку
      existingSubscription.subscription = subscription;
      existingSubscription.role = role || existingSubscription.role;
      existingSubscription.userAgent = userAgent;
      existingSubscription.platform = platform;
      existingSubscription.lastUpdated = new Date();
      await existingSubscription.save();
      logWithTime(`Обновлена push-подписка для ${role} на платформе ${platform}`);
      return res.status(200).json({ message: 'Подписка обновлена', platform });
    } else {
      // Создаем новую подписку
      const newSubscription = new PushSubscription({
        subscription,
        role: role || 'user',
        userAgent,
        platform
      });
      await newSubscription.save();
      logWithTime(`Создана новая push-подписка для ${role} на платформе ${platform}`);
      return res.status(201).json({ message: 'Подписка создана', platform });
    }
  } catch (err) {
    logWithTime(`Ошибка сохранения push-подписки: ${err.message}`);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Маршрут для сохранения FCM токена
app.post('/api/save-fcm-token', async (req, res) => {
  try {
    const { token, role } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Отсутствует токен' });
    }
    
    // Получаем User-Agent из заголовков запроса
    const userAgent = req.headers['user-agent'] || '';
    
    // Определяем платформу на основе User-Agent
    let platform = 'unknown';
    if (/android/i.test(userAgent)) {
      platform = 'android';
    } else if (/iPad|iPhone|iPod/.test(userAgent) && !req.headers['x-msstream']) {
      platform = 'ios';
    } else {
      platform = 'web';
    }
    
    logWithTime(`Сохранение FCM токена для ${role} на платформе ${platform}`);
    
    // Проверяем, существует ли уже такой токен
    const existingToken = await FCMToken.findOne({ token });
    
    if (existingToken) {
      // Обновляем существующий токен
      existingToken.role = role || existingToken.role;
      existingToken.platform = platform;
      existingToken.lastUpdated = new Date();
      await existingToken.save();
      logWithTime(`Обновлен FCM токен для ${role} на платформе ${platform}`);
      return res.status(200).json({ message: 'FCM токен обновлен', platform });
    } else {
      // Создаем новый токен
      const newToken = new FCMToken({
        token,
        role: role || 'user',
        platform
      });
      await newToken.save();
      logWithTime(`Создан новый FCM токен для ${role} на платформе ${platform}`);
      return res.status(201).json({ message: 'FCM токен сохранен', platform });
    }
  } catch (err) {
    logWithTime(`Ошибка сохранения FCM токена: ${err.message}`);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Функция для отправки push-уведомлений охране
async function sendPushToGuards(payload = {}) {
  try {
    // Получаем все подписки охранников
    const guardSubscriptions = await PushSubscription.find({ role: 'guard' });
    logWithTime(`Найдено ${guardSubscriptions.length} подписок охранников для отправки push`);
    
    const totalEndpoints = guardSubscriptions.length;
    
    if (totalEndpoints === 0) {
      logWithTime('Нет подписок охранников для отправки уведомлений');
      return;
    }
    
    // Формируем данные уведомления для Web Push
    const notificationPayload = JSON.stringify({
      title: payload.title || 'Внимание! SOS',
      body: payload.body || 'Поступил SOS-вызов',
      icon: '/icons/sos.svg',
      sosId: payload.sosId,
      url: payload.url || '/',
      timestamp: Date.now(),
      requireInteraction: true,
      vibrate: [200, 100, 200, 100, 200, 100, 400],
      tag: 'sos-notification',
      actions: [
        { action: 'accept', title: 'Принять' },
        { action: 'decline', title: 'Отклонить' }
      ],
      data: {
        sosId: payload.sosId,
        fullScreenIntent: true,
        timestamp: Date.now(),
        priority: 'high',
        contentAvailable: 1,
        mutableContent: 1,
        categoryId: 'sos',
        type: 'sos'
      }
    });
    
    // Массив для хранения результатов отправки
    const results = [];
    
    // Отправляем через Web Push API
    if (guardSubscriptions.length > 0) {
      // Группируем подписки по платформам
      const androidSubscriptions = guardSubscriptions.filter(sub => sub.platform === 'android');
      const iosSubscriptions = guardSubscriptions.filter(sub => sub.platform === 'ios');
      const webSubscriptions = guardSubscriptions.filter(sub => 
        sub.platform === 'web' || sub.platform === 'unknown'
      );
      
      logWithTime(`Распределение подписок по платформам: Android - ${androidSubscriptions.length}, iOS - ${iosSubscriptions.length}, Web - ${webSubscriptions.length}`);
      
      // Функция для отправки уведомлений на группу подписок
      const sendToSubscriptions = async (subscriptions, platformName) => {
        if (subscriptions.length === 0) return [];
        
        logWithTime(`Отправка уведомлений для ${subscriptions.length} подписок на платформе ${platformName}`);
        
        const sendPromises = subscriptions.map(sub => {
          // Настраиваем опции отправки
          const pushOptions = {
            vapidDetails: {
              subject: 'mailto:admin@novyy-gorizont-sos.com',
              publicKey: vapidKeys.publicKey,
              privateKey: vapidKeys.privateKey
            },
            TTL: 60 * 60, // 1 час
            urgency: 'high',
            topic: 'sos-alert',
            headers: {
              'Urgency': 'high',
              'Priority': 'high'
            }
          };
          
          // Для iOS добавляем дополнительные заголовки
          if (platformName === 'ios') {
            pushOptions.headers['content-available'] = '1';
            pushOptions.headers['mutable-content'] = '1';
            pushOptions.headers['X-Notification-Category'] = 'sos';
          }
          
          // Для Android добавляем заголовки для полноэкранных уведомлений
          if (platformName === 'android') {
            pushOptions.headers['X-Notification-Full-Screen'] = 'true';
            pushOptions.headers['X-Notification-Priority'] = 'high';
          }
          
          return webPush.sendNotification(sub.subscription, notificationPayload, pushOptions)
            .then(() => {
              logWithTime(`Push-уведомление успешно отправлено для ${sub._id} (${platformName})`);
              return { success: true, id: sub._id, platform: platformName };
            })
            .catch(err => {
              logWithTime(`Ошибка отправки push-уведомления для ${sub._id} (${platformName}): ${err.message}`);
              
              // Если подписка недействительна, удаляем её
              if (err.statusCode === 404 || err.statusCode === 410) {
                logWithTime(`Удаляем недействительную подписку ${sub._id}`);
                return PushSubscription.deleteOne({ _id: sub._id })
                  .then(() => ({ success: false, id: sub._id, deleted: true, platform: platformName }));
              }
              
              return { success: false, id: sub._id, error: err.message, platform: platformName };
            });
        });
        
        return Promise.all(sendPromises);
      };
      
      // Отправляем уведомления на разные платформы
      const androidResults = await sendToSubscriptions(androidSubscriptions, 'android');
      const iosResults = await sendToSubscriptions(iosSubscriptions, 'ios');
      const webResults = await sendToSubscriptions(webSubscriptions, 'web');
      
      // Объединяем результаты
      results.push(...androidResults, ...iosResults, ...webResults);
    }
    
    // Анализируем общие результаты
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const deleted = results.filter(r => r.deleted).length;
    
    logWithTime(`Уведомления отправлены: успешно - ${successful}, неудачно - ${failed}, удалено подписок - ${deleted}`);
    
    // Если все отправки неудачны, но есть подписки, повторяем через 5 секунд
    if (successful === 0 && totalEndpoints > 0) {
      logWithTime('Все отправки неудачны, повторная попытка через 5 секунд');
      setTimeout(() => {
        sendPushToGuards(payload).catch(err => {
          logWithTime(`Ошибка при повторной отправке уведомлений: ${err.message}`);
        });
      }, 5000);
    }
    
    // Если были успешные отправки, отправляем еще раз через 10 секунд для надежности
    // (особенно важно для iOS, где уведомления могут не доставляться с первого раза)
    if (successful > 0 && payload.sosId && !payload.isReminder) {
      logWithTime('Планируем повторную отправку через 10 секунд для надежности');
      setTimeout(() => {
        // Изменяем немного текст, чтобы обойти группировку уведомлений
        const reminderPayload = {
          ...payload,
          title: payload.title || 'Внимание! SOS (напоминание)',
          body: (payload.body || 'Поступил SOS-вызов') + ' (напоминание)',
          isReminder: true
        };
        sendPushToGuards(reminderPayload).catch(err => {
          logWithTime(`Ошибка при отправке напоминания: ${err.message}`);
        });
      }, 10000);
      
      // Для iOS отправляем еще одно напоминание через 30 секунд
      // iOS часто блокирует уведомления, если они приходят слишком часто
      if (guardSubscriptions.some(sub => sub.platform === 'ios')) {
        logWithTime('Планируем дополнительное напоминание для iOS через 30 секунд');
        setTimeout(() => {
          const iosReminderPayload = {
            ...payload,
            title: payload.title || 'Срочно! SOS (повторно)',
            body: (payload.body || 'Поступил SOS-вызов') + ' (требуется внимание)',
            isReminder: true,
            iosSpecific: true
          };
          
          // Отправляем только на iOS устройства
          PushSubscription.find({ role: 'guard', platform: 'ios' })
            .then(iosSubscriptions => {
              if (iosSubscriptions.length > 0) {
                logWithTime(`Отправка дополнительного напоминания на ${iosSubscriptions.length} iOS устройств`);
                
                const sendPromises = iosSubscriptions.map(sub => {
                  const pushOptions = {
                    vapidDetails: {
                      subject: 'mailto:admin@1fxpro.vip',
                      publicKey: vapidKeys.publicKey,
                      privateKey: vapidKeys.privateKey
                    },
                    TTL: 60 * 60,
                    urgency: 'high',
                    headers: {
                      'content-available': '1',
                      'mutable-content': '1',
                      'X-Notification-Category': 'sos'
                    }
                  };
                  
                  return webPush.sendNotification(
                    sub.subscription, 
                    JSON.stringify({
                      ...JSON.parse(notificationPayload),
                      title: iosReminderPayload.title,
                      body: iosReminderPayload.body,
                      tag: 'sos-notification-reminder',
                      timestamp: Date.now()
                    }),
                    pushOptions
                  ).catch(err => {
                    logWithTime(`Ошибка отправки iOS напоминания для ${sub._id}: ${err.message}`);
                  });
                });
                
                Promise.all(sendPromises)
                  .then(() => logWithTime('Дополнительное iOS напоминание отправлено'))
                  .catch(err => logWithTime(`Ошибка отправки iOS напоминаний: ${err.message}`));
              }
            })
            .catch(err => {
              logWithTime(`Ошибка поиска iOS подписок: ${err.message}`);
            });
        }, 30000);
      }
    }
  } catch (err) {
    logWithTime(`Ошибка при отправке уведомлений: ${err.message}`);
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

  // Обработка отмены SOS сигнала через сокет
  socket.on('cancel-sos', async ({ id }) => {
    try {
      logWithTime(`Получен запрос на отмену SOS ${id} через сокет`);
      
      // Находим вызов в базе данных
      const sos = await Sos.findOne({ sosId: id });
      
      if (sos) {
        // Обновляем статус вызова
        sos.status = 'canceled';
        sos.endedAt = new Date();
        await sos.save();
        
        // Оповещаем охрану об отмене вызова
        socket.to('guard').emit('sos-canceled', { id });
        logWithTime(`Охрана уведомлена об отмене SOS ${id}`);
        
        // Отправляем подтверждение клиенту
        socket.emit('sos-cancel-confirmed', { id });
      } else {
        logWithTime(`SOS ${id} не найден для отмены`);
        socket.emit('error', { message: 'SOS вызов не найден' });
      }
    } catch (err) {
      logWithTime(`Ошибка при отмене SOS через сокет: ${err.message}`);
      socket.emit('error', { message: 'Не удалось отменить SOS сигнал' });
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

