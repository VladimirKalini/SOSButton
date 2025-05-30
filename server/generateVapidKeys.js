const webpush = require('web-push');

// Генерируем VAPID ключи
const vapidKeys = webpush.generateVAPIDKeys();

console.log('VAPID ключи успешно сгенерированы:');
console.log('===============================');
console.log(`Публичный ключ: ${vapidKeys.publicKey}`);
console.log(`Приватный ключ: ${vapidKeys.privateKey}`);
console.log('===============================');
console.log('Добавьте эти ключи в переменные окружения:');
console.log('VAPID_PUBLIC_KEY и VAPID_PRIVATE_KEY');
console.log('Или обновите их в server/services/notificationService.js'); 