const mongoose = require('mongoose');
const readline = require('readline');
require('dotenv').config();

// Создаем интерфейс для чтения из консоли
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Подключаемся к MongoDB
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sos-button';
mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Успешное подключение к MongoDB');
  runMigration();
}).catch(err => {
  console.error('Ошибка подключения к MongoDB:', err);
  process.exit(1);
});

// Определяем схему пользователя
const userSchema = new mongoose.Schema({
  phone: String,
  name: String,
  passwordHash: String,
  role: String
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// Функция для запуска миграции
async function runMigration() {
  try {
    // Проверяем, есть ли пользователи без имени
    const usersWithoutName = await User.find({ name: { $exists: false } });
    
    if (usersWithoutName.length === 0) {
      console.log('Все пользователи уже имеют поле name. Миграция не требуется.');
      process.exit(0);
    }
    
    console.log(`Найдено ${usersWithoutName.length} пользователей без поля name.`);
    
    // Спрашиваем, хочет ли пользователь продолжить
    rl.question('Хотите продолжить миграцию? (y/n): ', async (answer) => {
      if (answer.toLowerCase() !== 'y') {
        console.log('Миграция отменена.');
        process.exit(0);
      }
      
      // Обновляем пользователей
      for (const user of usersWithoutName) {
        const defaultName = user.role === 'guard' ? 'Охранник' : 'Пользователь';
        await User.updateOne(
          { _id: user._id },
          { $set: { name: `${defaultName} ${user.phone.slice(-4)}` } }
        );
        console.log(`Обновлен пользователь ${user._id}: добавлено имя "${defaultName} ${user.phone.slice(-4)}"`);
      }
      
      console.log('Миграция успешно завершена!');
      process.exit(0);
    });
  } catch (err) {
    console.error('Ошибка при выполнении миграции:', err);
    process.exit(1);
  }
} 