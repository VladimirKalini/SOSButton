/**
 * Запрашивает разрешение на показ уведомлений
 * @returns {Promise<boolean>} Результат запроса разрешения
 */
export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.log('Браузер не поддерживает уведомления');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
};

/**
 * Показывает нативное уведомление с возможностью обработки клика
 * @param {string} title Заголовок уведомления
 * @param {object} options Опции уведомления
 * @param {Function} onClick Функция-обработчик клика по уведомлению
 * @returns {Notification|null} Объект уведомления или null
 */
export const showNotification = (title, options = {}, onClick = null) => {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return null;
  }

  // Настройки по умолчанию
  const defaultOptions = {
    icon: '/logo192.png',
    vibrate: [200, 100, 200],
    requireInteraction: true // Уведомление не исчезает автоматически
  };

  const notification = new Notification(title, { ...defaultOptions, ...options });
  
  if (onClick && typeof onClick === 'function') {
    notification.onclick = () => {
      window.focus();
      onClick();
    };
  }

  return notification;
};

/**
 * Показывает оверлей-уведомление о входящем вызове
 * @param {object} data Данные о вызове
 * @param {Function} onAccept Функция при принятии вызова
 * @param {Function} onDecline Функция при отклонении вызова
 */
export const showIncomingCallOverlay = (data, onAccept, onDecline) => {
  const displayName = data.userName || data.phone;
  
  // Создаем элемент оверлея
  const overlay = document.createElement('div');
  overlay.id = 'incoming-call-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.8);
    z-index: 9999;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: white;
    font-family: Arial, sans-serif;
  `;

  // Создаем содержимое оверлея
  overlay.innerHTML = `
    <div style="text-align: center; padding: 20px;">
      <div style="font-size: 24px; margin-bottom: 10px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" viewBox="0 0 16 16" style="animation: pulse 1.5s infinite; margin-bottom: 15px;">
          <path d="M11 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h6zM5 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H5z"/>
          <path d="M8 14a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/>
        </svg>
        <div style="font-size: 36px; font-weight: bold; margin-bottom: 10px;">SOS ВЫЗОВ!</div>
      </div>
      <div style="font-size: 24px; margin-bottom: 30px;">
        ${displayName}
      </div>
      <div style="display: flex; justify-content: center; gap: 20px;">
        <button id="accept-call" style="
          padding: 15px 30px;
          background-color: #28a745;
          color: white;
          border: none;
          border-radius: 50px;
          font-size: 18px;
          font-weight: bold;
          cursor: pointer;
          display: flex;
          align-items: center;
        ">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16" style="margin-right: 10px;">
            <path d="M0 5a2 2 0 0 1 2-2h7.5a2 2 0 0 1 1.983 1.738l3.11-1.382A1 1 0 0 1 16 4.269v7.462a1 1 0 0 1-1.406.913l-3.111-1.382A2 2 0 0 1 9.5 13H2a2 2 0 0 1-2-2V5z"/>
          </svg>
          Принять
        </button>
        <button id="decline-call" style="
          padding: 15px 30px;
          background-color: #dc3545;
          color: white;
          border: none;
          border-radius: 50px;
          font-size: 18px;
          font-weight: bold;
          cursor: pointer;
          display: flex;
          align-items: center;
        ">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16" style="margin-right: 10px;">
            <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
            <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
          </svg>
          Отклонить
        </button>
      </div>
    </div>
    <style>
      @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.2); }
        100% { transform: scale(1); }
      }
    </style>
  `;

  // Добавляем оверлей в DOM
  document.body.appendChild(overlay);

  // Создаем аудио элемент для сирены
  const audio = new Audio('/siren.mp3');
  audio.loop = true;
  audio.play().catch(err => console.error('Ошибка воспроизведения сирены:', err));

  // Добавляем обработчики событий
  document.getElementById('accept-call').addEventListener('click', () => {
    audio.pause();
    audio.currentTime = 0;
    document.body.removeChild(overlay);
    if (onAccept && typeof onAccept === 'function') {
      onAccept();
    }
  });

  document.getElementById('decline-call').addEventListener('click', () => {
    audio.pause();
    audio.currentTime = 0;
    document.body.removeChild(overlay);
    if (onDecline && typeof onDecline === 'function') {
      onDecline();
    }
  });

  // Возвращаем функцию для закрытия оверлея
  return () => {
    if (document.body.contains(overlay)) {
      audio.pause();
      audio.currentTime = 0;
      document.body.removeChild(overlay);
    }
  };
}; 