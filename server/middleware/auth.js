const jwt = require('jsonwebtoken');
const User = require('../../src/models/User');

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Нет токена' });
  }
  
  const token = authHeader.slice(7);
  
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'very_secret_key');
    
    // Находим пользователя
    const user = await User.findById(payload.userId);
    
    if (!user) {
      return res.status(401).json({ message: 'Пользователь не найден' });
    }
    
    // Проверяем deviceId, если он есть в токене и в профиле пользователя
    if (payload.deviceId && user.deviceId && payload.deviceId !== user.deviceId) {
      return res.status(401).json({ message: 'Недействительный deviceId' });
    }
    
    // Добавляем пользователя в объект запроса
    req.user = user;
    next();
  } catch (error) {
    console.error('Ошибка аутентификации:', error.message);
    return res.status(401).json({ message: 'Неверный токен' });
  }
}

module.exports = authMiddleware; 