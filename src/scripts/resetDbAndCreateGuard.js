const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const Sos = require('../models/Sos');

// Настройки подключения к MongoDB
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/sos-app';

// Данные для нового аккаунта охраны
const guardData = {
  phone: '+79000000000', // Измените на нужный номер телефона
  name: 'Охрана',        // Измените на нужное имя
  password: 'guard123',  // Измените на нужный пароль
  role: 'guard'
};

// Функция для очистки базы данных и создания нового аккаунта охраны
async function resetDbAndCreateGuard() {
  try {
    // Подключение к MongoDB
    console.log(`Подключение к MongoDB: ${mongoUri}`);
    await mongoose.connect(mongoUri);
    console.log('Подключено к MongoDB');

    // Очистка коллекций
    console.log('Очистка коллекции пользователей...');
    await User.deleteMany({});
    console.log('Коллекция пользователей очищена');

    console.log('Очистка коллекции SOS вызовов...');
    await Sos.deleteMany({});
    console.log('Коллекция SOS вызовов очищена');

    // Создание нового аккаунта охраны
    console.log('Создание нового аккаунта охраны...');
    const passwordHash = await bcrypt.hash(guardData.password, 10);
    
    const guard = new User({
      phone: guardData.phone,
      name: guardData.name,
      passwordHash,
      role: guardData.role
    });
    
    await guard.save();
    console.log(`Аккаунт охраны создан: ${guard.name} (${guard.phone})`);
    console.log('Данные для входа:');
    console.log(`Телефон: ${guardData.phone}`);
    console.log(`Пароль: ${guardData.password}`);

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
resetDbAndCreateGuard(); 