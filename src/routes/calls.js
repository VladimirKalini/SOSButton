// src/routes/calls.js
const express = require('express');
const Sos = require('../models/Sos');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const router = express.Router();

// Настройка хранилища для multer
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const uploadsDir = path.join(__dirname, '../../uploads/videos');
    
    // Создаем директорию, если она не существует
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log('Создана директория для загрузки видео:', uploadsDir);
    }
    
    cb(null, uploadsDir);
  },
  filename: function(req, file, cb) {
    const sosId = req.body.sosId;
    // Генерируем уникальное имя файла с временной меткой
    const filename = `${sosId}_${Date.now()}.webm`;
    console.log(`Создание файла: ${filename}`);
    cb(null, filename);
  }
});

// Настройка лимитов для загрузки файлов
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB максимальный размер файла
});

router.use(authMiddleware);

// Получить активные вызовы (только охрана)
router.get('/active', roleMiddleware('guard'), async (req, res) => {
  try {
    const calls = await Sos.find({ status: 'active' }).sort('-createdAt');
    res.json(calls);
  } catch (err) {
    console.error('Ошибка при получении активных вызовов:', err);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Получить детали конкретного вызова (только охрана)
router.get('/:id', roleMiddleware('guard'), async (req, res) => {
  try {
    const sos = await Sos.findById(req.params.id);
    if (!sos) {
      return res.status(404).json({ message: 'SOS-вызов не найден' });
    }
    res.json(sos);
  } catch (err) {
    console.error('Ошибка при получении деталей вызова:', err);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Отменить свой сигнал (пользователь)
router.delete('/:id', async (req, res) => {
  try {
    const sos = await Sos.findById(req.params.id);
    if (!sos) {
      return res.status(404).json({ message: 'Сигнал не найден' });
    }
    if (sos.phone !== req.user.phone) {
      return res.status(403).json({ message: 'Нельзя отменить чужой сигнал' });
    }
    sos.status = 'cancelled';
    await sos.save();
    req.app.get('io').to(sos.sosId).emit('sos-canceled', { id: sos._id });
    res.json(sos);
  } catch (err) {
    console.error('Ошибка при отмене сигнала:', err);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Отменить любой сигнал (охрана)
router.delete('/:id/cancel', roleMiddleware('guard'), async (req, res) => {
  try {
    const sos = await Sos.findById(req.params.id);
    if (!sos) {
      return res.status(404).json({ message: 'SOS-вызов не найден' });
    }
    sos.status = 'cancelled';
    await sos.save();
    req.app.get('io').to(sos.sosId).emit('sos-canceled', { id: sos._id });
    res.json(sos);
  } catch (err) {
    console.error('Ошибка при отмене вызова:', err);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// История вызовов (только охрана) с пагинацией
router.get('/history', roleMiddleware('guard'), async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const calls = await Sos.find()
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit);
    res.json(calls);
  } catch (err) {
    console.error('Ошибка при получении истории вызовов:', err);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Запись видео с устройства пользователя
router.post('/record', upload.single('videoChunk'), async (req, res) => {
  try {
    console.log('Получен запрос на запись видео');
    
    if (!req.file) {
      console.error('Файл не был загружен');
      return res.status(400).json({ message: 'Файл не был загружен' });
    }
    
    const { sosId } = req.body;
    console.log(`Обработка видео для SOS ID: ${sosId}, файл: ${req.file.filename}`);
    
    const sos = await Sos.findOne({ sosId: sosId });
    
    if (!sos) {
      // Удаляем загруженный файл, если вызов не найден
      if (req.file) {
        fs.unlinkSync(req.file.path);
        console.error(`SOS-вызов не найден, файл удален: ${req.file.path}`);
      }
      return res.status(404).json({ message: 'SOS-вызов не найден' });
    }
    
    // Создаем директорию для видео этого вызова, если еще не создана
    const sosDir = path.join(__dirname, '../../uploads/videos', sosId);
    if (!fs.existsSync(sosDir)) {
      fs.mkdirSync(sosDir, { recursive: true });
      console.log(`Создана директория для видео SOS ${sosId}: ${sosDir}`);
    }
    
    // Перемещаем файл в директорию вызова
    const newPath = path.join(sosDir, req.file.filename);
    fs.renameSync(req.file.path, newPath);
    console.log(`Файл перемещен в: ${newPath}`);
    
    // Обновляем запись в базе данных
    if (!sos.recordingStarted) {
      sos.recordingStarted = true;
      sos.videoPath = sosDir;
      await sos.save();
      console.log(`Запись SOS ${sosId} обновлена: recordingStarted=true, videoPath=${sosDir}`);
    }
    
    res.status(200).json({ message: 'Видеофрагмент успешно сохранен' });
  } catch (err) {
    console.error('Ошибка при сохранении видео:', err);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Получить записанное видео (только охрана)
router.get('/:id/video', roleMiddleware('guard'), async (req, res) => {
  try {
    console.log(`Запрос на получение видео для SOS ${req.params.id}`);
    
    const sos = await Sos.findById(req.params.id);
    
    if (!sos || !sos.videoPath) {
      console.log(`Видео не найдено для SOS ${req.params.id}`);
      return res.status(404).json({ message: 'Видео не найдено' });
    }
    
    // Получаем список файлов в директории
    const videoDir = sos.videoPath;
    console.log(`Чтение директории с видео: ${videoDir}`);
    
    fs.readdir(videoDir, (err, files) => {
      if (err) {
        console.error('Ошибка при чтении директории с видео:', err);
        return res.status(500).json({ message: 'Ошибка сервера' });
      }
      
      // Сортируем файлы по времени создания
      const videoFiles = files
        .filter(file => file.endsWith('.webm'))
        .map(file => ({
          name: file,
          path: path.join(videoDir, file),
          url: `/uploads/videos/${sos.sosId}/${file}`
        }))
        .sort((a, b) => {
          // Сортировка по времени создания (извлекаем timestamp из имени файла)
          const timeA = parseInt(a.name.split('_')[1].split('.')[0]);
          const timeB = parseInt(b.name.split('_')[1].split('.')[0]);
          return timeB - timeA; // От новых к старым
        });
      
      console.log(`Найдено ${videoFiles.length} видеофайлов для SOS ${req.params.id}`);
      res.json(videoFiles);
    });
  } catch (err) {
    console.error('Ошибка при получении видео:', err);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

module.exports = router;
