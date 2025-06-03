const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const readline = require('readline');

// Создаем интерфейс для чтения из консоли
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Настройки подключения к MongoDB
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/sos-app';

// Функция для создания нового аккаунта охраны
async function createGuard() {
  try {
    // Подключение к MongoDB
    console.log(`Подключение к MongoDB: ${mongoUri}`);
    await mongoose.connect(mongoUri);
    console.log('Подключено к MongoDB');

    // Запрашиваем данные для нового аккаунта
    console.log('\nВведите данные для нового аккаунта охраны:');
    
    // Запрашиваем номер телефона
    const phone = await new Promise(resolve => {
      rl.question('Телефон (в формате +380XXXXXXXXX): ', answer => {
        // Проверяем формат телефона
        if (!/^\+\d{12}$/.test(answer)) {
          console.log('Ошибка: Телефон должен содержать ровно 12 цифр после знака +');
          process.exit(1);
        }
        resolve(answer);
      });
    });
    
    // Проверяем, существует ли уже пользователь с таким телефоном
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      console.log(`Ошибка: Пользователь с телефоном ${phone} уже существует`);
      process.exit(1);
    }
    
    // Запрашиваем имя
    const name = await new Promise(resolve => {
      rl.question('Имя: ', answer => {
        if (!answer.trim()) {
          console.log('Ошибка: Имя не может быть пустым');
          process.exit(1);
        }
        resolve(answer);
      });
    });
    
    // Запрашиваем пароль
    const password = await new Promise(resolve => {
      rl.question('Пароль (минимум 6 символов): ', answer => {
        if (answer.length < 6) {
          console.log('Ошибка: Пароль должен содержать минимум 6 символов');
          process.exit(1);
        }
        resolve(answer);
      });
    });
    
    // Подтверждение создания
    await new Promise(resolve => {
      console.log('\nПроверьте введенные данные:');
      console.log(`Телефон: ${phone}`);
      console.log(`Имя: ${name}`);
      console.log(`Пароль: ${password}`);
      console.log(`Роль: guard (охрана)`);
      
      rl.question('\nСоздать аккаунт? (y/n): ', answer => {
        if (answer.toLowerCase() !== 'y') {
          console.log('Операция отменена.');
          process.exit(0);
        }
        resolve();
      });
    });
    
    // Создание аккаунта охраны
    console.log('\nСоздание аккаунта охраны...');
    const passwordHash = await bcrypt.hash(password, 10);
    
    const guard = new User({
      phone,
      name,
      passwordHash,
      role: 'guard'
    });
    
    await guard.save();
    console.log(`\nАккаунт охраны успешно создан: ${guard.name} (${guard.phone})`);
    console.log('Данные для входа:');
    console.log(`Телефон: ${phone}`);
    console.log(`Пароль: ${password}`);

    // Отключение от базы данных
    await mongoose.disconnect();
    console.log('Отключено от MongoDB');
    
    console.log('\nОперация успешно завершена!');
    rl.close();
  } catch (error) {
    console.error('Ошибка:', error);
    rl.close();
    process.exit(1);
  }
}

// Запуск функции
createGuard(); 