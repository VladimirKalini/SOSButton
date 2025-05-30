# SOS Button App

Приложение для экстренных вызовов охраны с поддержкой WebRTC и Push-уведомлений.

## Настройка Push-уведомлений

Для работы push-уведомлений необходимо выполнить следующие шаги:

1. Установить необходимые зависимости:
   ```bash
   npm install web-push uuid --save
   ```

2. Сгенерировать VAPID ключи:
   ```bash
   node server/generateVapidKeys.js
   ```

3. Полученные ключи добавить в переменные окружения:
   ```
   VAPID_PUBLIC_KEY=ваш_публичный_ключ
   VAPID_PRIVATE_KEY=ваш_приватный_ключ
   VAPID_EMAIL=mailto:your-email@example.com
   ```
   
   Или обновить их напрямую в файле `server/services/notificationService.js`

4. Заменить заглушки файлов на реальные:
   - `public/icons/sos-icon-192.png` - иконка для push-уведомлений (192x192 px)
   - `public/icons/sos-badge-96.png` - иконка-бейдж для push-уведомлений (96x96 px)
   - `public/siren.mp3` - звук сирены для уведомлений

5. Перезапустить сервер:
   ```bash
   npm run start:server
   ```

## Структура проекта

### Клиентская часть (React)
- `src/services/pushService.js` - сервис для работы с подписками на push-уведомления
- `src/services/notificationService.js` - сервис для работы с уведомлениями на клиенте
- `src/components/GuardDashboard.jsx` - панель охраны с поддержкой push-уведомлений

### Серверная часть (Express)
- `server/services/notificationService.js` - сервис для отправки push-уведомлений
- `server/models/PushSubscription.js` - модель для хранения подписок
- `server/routes/push.js` - API маршруты для работы с push-уведомлениями
- `server/middleware/auth.js` - middleware для аутентификации

### Service Worker
- `public/sw.js` - сервис-воркер с поддержкой push-уведомлений и оффлайн-режима

## Тестирование push-уведомлений

1. Войдите в систему как охранник
2. Предоставьте разрешение на показ уведомлений в браузере
3. Нажмите кнопку "Тест Push" на панели охраны
4. Должно появиться уведомление с звуковым сигналом

## Особенности реализации

- Поддерживается сохранение сессии на устройстве (persist login)
- Адаптивная верстка для мобильных устройств
- Звуковое оповещение при получении SOS-вызова
- Оверлей с информацией о вызове
- Возможность принять или отклонить вызов прямо из уведомления
