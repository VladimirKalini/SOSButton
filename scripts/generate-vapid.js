/**
 * Скрипт для генерации VAPID ключей для push-уведомлений
 * Запуск: node scripts/generate-vapid.js
 */

const webpush = require('web-push');
const fs = require('fs');
const path = require('path');

// Генерируем новую пару VAPID ключей
const vapidKeys = webpush.generateVAPIDKeys();

console.log('\n=== VAPID КЛЮЧИ ДЛЯ PUSH-УВЕДОМЛЕНИЙ ===\n');
console.log(`Публичный ключ: ${vapidKeys.publicKey}`);
console.log(`Приватный ключ: ${vapidKeys.privateKey}`);
console.log('\nСохраните эти ключи в безопасном месте!\n');

// Создаем .env файл с ключами, если его еще нет
const envPath = path.join(__dirname, '..', '.env');
let envContent = '';

if (fs.existsSync(envPath)) {
  // Если файл существует, читаем его содержимое
  envContent = fs.readFileSync(envPath, 'utf8');
  
  // Заменяем существующие ключи или добавляем новые
  if (envContent.includes('VAPID_PUBLIC_KEY=')) {
    envContent = envContent.replace(/VAPID_PUBLIC_KEY=.*\n/, `VAPID_PUBLIC_KEY=${vapidKeys.publicKey}\n`);
  } else {
    envContent += `\nVAPID_PUBLIC_KEY=${vapidKeys.publicKey}`;
  }
  
  if (envContent.includes('VAPID_PRIVATE_KEY=')) {
    envContent = envContent.replace(/VAPID_PRIVATE_KEY=.*\n/, `VAPID_PRIVATE_KEY=${vapidKeys.privateKey}\n`);
  } else {
    envContent += `\nVAPID_PRIVATE_KEY=${vapidKeys.privateKey}`;
  }
  
  if (!envContent.includes('VAPID_EMAIL=')) {
    envContent += `\nVAPID_EMAIL=mailto:admin@example.com`;
  }
} else {
  // Если файла нет, создаем новый с ключами
  envContent = `# Автоматически сгенерированные VAPID ключи для push-уведомлений
VAPID_PUBLIC_KEY=${vapidKeys.publicKey}
VAPID_PRIVATE_KEY=${vapidKeys.privateKey}
VAPID_EMAIL=mailto:admin@example.com
`;
}

// Записываем обновленное содержимое в .env файл
fs.writeFileSync(envPath, envContent);

console.log(`Ключи сохранены в файле .env`);

// Обновляем ключи в клиентском сервисе
const pushServicePath = path.join(__dirname, '..', 'src', 'services', 'pushService.js');
if (fs.existsSync(pushServicePath)) {
  let pushServiceContent = fs.readFileSync(pushServicePath, 'utf8');
  
  // Заменяем публичный ключ
  pushServiceContent = pushServiceContent.replace(
    /const publicVapidKey = ['"].*['"];/,
    `const publicVapidKey = '${vapidKeys.publicKey}';`
  );
  
  fs.writeFileSync(pushServicePath, pushServiceContent);
  console.log(`Публичный ключ обновлен в файле src/services/pushService.js`);
}

// Обновляем ключи в серверном сервисе
const notificationServicePath = path.join(__dirname, '..', 'server', 'services', 'notificationService.js');
if (fs.existsSync(notificationServicePath)) {
  let notificationServiceContent = fs.readFileSync(notificationServicePath, 'utf8');
  
  // Заменяем публичный и приватный ключи
  notificationServiceContent = notificationServiceContent.replace(
    /const VAPID_PUBLIC_KEY = .*$/m,
    `const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '${vapidKeys.publicKey}';`
  );
  
  notificationServiceContent = notificationServiceContent.replace(
    /const VAPID_PRIVATE_KEY = .*$/m,
    `const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '${vapidKeys.privateKey}';`
  );
  
  fs.writeFileSync(notificationServicePath, notificationServiceContent);
  console.log(`Ключи обновлены в файле server/services/notificationService.js`);
}

console.log('\nГотово! VAPID ключи успешно сгенерированы и сохранены.\n'); 