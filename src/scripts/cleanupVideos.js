// src/scripts/cleanupVideos.js
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Sos = require('../models/Sos');

// Подключение к MongoDB
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/sos-app';

async function cleanupVideos() {
  try {
    console.log('Запуск процесса очистки устаревших видеозаписей...');
    
    // Подключение к базе данных
    await mongoose.connect(mongoUri);
    console.log('Подключено к MongoDB');
    
    const uploadsDir = path.join(__dirname, '../../uploads/videos');
    
    // Проверяем существование директории
    if (!fs.existsSync(uploadsDir)) {
      console.log('Директория с видео не найдена');
      return;
    }
    
    // Получаем все активные записи
    const activeCalls = await Sos.find({}, { sosId: 1 });
    const activeIds = activeCalls.map(call => call.sosId).filter(Boolean);
    
    // Получаем все директории в uploads/videos
    const directories = fs.readdirSync(uploadsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    // Находим директории, которые не соответствуют активным вызовам
    const obsoleteDirs = directories.filter(dir => !activeIds.includes(dir));
    
    console.log(`Найдено ${obsoleteDirs.length} устаревших директорий для удаления`);
    
    // Удаляем устаревшие директории
    for (const dir of obsoleteDirs) {
      const dirPath = path.join(uploadsDir, dir);
      
      // Удаляем все файлы в директории
      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        fs.unlinkSync(path.join(dirPath, file));
      }
      
      // Удаляем саму директорию
      fs.rmdirSync(dirPath);
      console.log(`Удалена директория: ${dirPath}`);
    }
    
    console.log('Очистка завершена успешно');
  } catch (error) {
    console.error('Ошибка при очистке видеозаписей:', error);
  } finally {
    // Закрываем соединение с базой данных
    await mongoose.connection.close();
    console.log('Соединение с MongoDB закрыто');
  }
}

// Запускаем функцию, если скрипт запущен напрямую
if (require.main === module) {
  cleanupVideos()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = cleanupVideos; 