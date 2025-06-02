const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../models/User');

// Настройки подключения к MongoDB
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/sos-app';

// Массив тестовых пользователей
const testUsers = [
  {
    phone: '+79001234567',
    name: 'Иван Петров',
    password: 'user123',
    role: 'user'
  },
  {
    phone: '+79002345678',
    name: 'Анна Сидорова',
    password: 'user123',
    role: 'user'
  },
  {
    phone: '+79003456789',
    name: 'Петр Иванов',
    password: 'user123',
    role: 'user'
  }
];

// Функция для создания тестовых пользователей
async function createTestUsers() {
  try {
    // Подключение к MongoDB
    console.log(`Подключение к MongoDB: ${mongoUri}`);
    await mongoose.connect(mongoUri);
    console.log('Подключено к MongoDB');

    // Создание тестовых пользователей
    console.log('Создание тестовых пользователей...');
    
    for (const userData of testUsers) {
      // Проверяем, существует ли пользователь с таким телефоном
      const existingUser = await User.findOne({ phone: userData.phone });
      
      if (existingUser) {
        console.log(`Пользователь с телефоном ${userData.phone} уже существует, пропускаем...`);
        continue;
      }
      
      // Создаем нового пользователя
      const passwordHash = await bcrypt.hash(userData.password, 10);
      
      const user = new User({
        phone: userData.phone,
        name: userData.name,
        passwordHash,
        role: userData.role
      });
      
      await user.save();
      console.log(`Пользователь создан: ${user.name} (${user.phone})`);
    }
    
    // Выводим список всех пользователей
    console.log('\nСписок всех пользователей в базе данных:');
    const users = await User.find({});
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} (${user.phone}) - роль: ${user.role}`);
    });

    // Отключение от базы данных
    await mongoose.disconnect();
    console.log('Отключено от MongoDB');
    
    console.log('Операция успешно завершена!');
  } catch (error) {
    console.error('Ошибка:', error);
    process.exit(1);
  }
}

// Запуск функции
createTestUsers(); 