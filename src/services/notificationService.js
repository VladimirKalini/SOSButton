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

// Создаем единый аудио-контекст для всего приложения
let audioContext = null;
let audioSource = null;
let audioBuffer = null;
let audioElement = null;

/**
 * Инициализирует аудио-контекст и загружает звук сирены
 * @returns {Promise<boolean>} Результат инициализации
 */
export const initAudioContext = async () => {
  try {
    // Создаем аудио-контекст при первом вызове
    if (!audioContext) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioContext = new AudioContext();
    }
    
    // Если буфер уже загружен, не загружаем повторно
    if (audioBuffer) {
      return true;
    }
    
    // Загружаем звук сирены
    const response = await fetch('/siren.mp3');
    const arrayBuffer = await response.arrayBuffer();
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    return true;
  } catch (err) {
    console.error('Ошибка инициализации аудио:', err);
    return false;
  }
};

/**
 * Воспроизводит звук сирены в цикле
 * @returns {Promise<boolean>} Результат запуска воспроизведения
 */
export const playSiren = async () => {
  try {
    // Используем HTML5 Audio API для лучшей поддержки мобильных устройств
    if (!audioElement) {
      audioElement = new Audio('/siren.mp3');
      audioElement.loop = true;
    }
    
    // Проверяем, что аудио не воспроизводится в данный момент
    if (audioElement.paused) {
      try {
        // Пробуем воспроизвести звук через HTML5 Audio API
        await audioElement.play();
        console.log('Сирена воспроизводится через HTML5 Audio');
        return true;
      } catch (htmlAudioErr) {
        console.warn('Не удалось воспроизвести через HTML5 Audio, пробуем Web Audio API:', htmlAudioErr);
        
        // Если HTML5 Audio не сработал, пробуем Web Audio API
        if (!audioContext) {
          await initAudioContext();
        }
        
        // Если аудио-контекст в состоянии suspended (например, из-за политики браузера),
        // пытаемся его возобновить
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }
        
        // Останавливаем предыдущее воспроизведение, если оно есть
        if (audioSource) {
          audioSource.stop();
          audioSource.disconnect();
        }
        
        // Создаем новый источник звука
        audioSource = audioContext.createBufferSource();
        audioSource.buffer = audioBuffer;
        audioSource.loop = true;
        audioSource.connect(audioContext.destination);
        audioSource.start(0);
        
        console.log('Сирена воспроизводится через Web Audio API');
        return true;
      }
    }
    
    return true;
  } catch (err) {
    console.error('Ошибка воспроизведения сирены:', err);
    return false;
  }
};

/**
 * Останавливает воспроизведение сирены
 */
export const stopSiren = () => {
  // Останавливаем HTML5 Audio
  if (audioElement) {
    audioElement.pause();
    audioElement.currentTime = 0;
  }
  
  // Останавливаем Web Audio API
  if (audioSource) {
    try {
      audioSource.stop();
      audioSource.disconnect();
      audioSource = null;
    } catch (err) {
      console.error('Ошибка остановки сирены через Web Audio API:', err);
    }
  }
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
    vibrate: [200, 100, 200, 100, 200],
    requireInteraction: true, // Уведомление не исчезает автоматически
    silent: true // Отключаем стандартный звук уведомления, т.к. используем свой
  };

  // Для мобильных устройств добавляем дополнительные опции
  if ('serviceWorker' in navigator && 'PushManager' in window) {
    // Эти опции будут использоваться в service worker для создания уведомления
    // с полноэкранным режимом на Android
    defaultOptions.data = {
      fullScreenIntent: true,
      soundName: 'siren.mp3',
      actions: [
        {
          action: 'accept',
          title: 'Принять'
        },
        {
          action: 'decline',
          title: 'Отклонить'
        }
      ]
    };
  }

  const notification = new Notification(title, { ...defaultOptions, ...options });
  
  if (onClick && typeof onClick === 'function') {
    notification.onclick = () => {
      window.focus();
      onClick();
    };
  }

  // Воспроизводим сирену при показе уведомления
  playSiren().catch(console.error);

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
    background-color: rgba(0, 0, 0, 0.9);
    z-index: 9999;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: white;
    font-family: Arial, sans-serif;
  `;

  // Создаем содержимое оверлея с адаптивными стилями
  overlay.innerHTML = `
    <div style="text-align: center; padding: 20px; width: 100%; max-width: 500px;">
      <div style="font-size: clamp(18px, 5vw, 24px); margin-bottom: 10px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="clamp(32px, 10vw, 48px)" height="clamp(32px, 10vw, 48px)" fill="currentColor" viewBox="0 0 16 16" style="animation: pulse 1.5s infinite; margin-bottom: 15px;">
          <path d="M11 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h6zM5 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H5z"/>
          <path d="M8 14a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/>
        </svg>
        <div style="font-size: clamp(24px, 8vw, 36px); font-weight: bold; margin-bottom: 10px; color: #ff3b30;">SOS ВЫЗОВ!</div>
      </div>
      <div style="font-size: clamp(18px, 6vw, 24px); margin-bottom: 30px;">
        <div style="font-weight: bold;">${displayName}</div>
        <div style="font-size: clamp(14px, 4vw, 18px); opacity: 0.8;">${data.phone}</div>
      </div>
      <div style="display: flex; justify-content: center; gap: clamp(10px, 4vw, 20px); flex-wrap: wrap;">
        <button id="accept-call" style="
          padding: clamp(10px, 3vw, 15px) clamp(20px, 6vw, 30px);
          background-color: #28a745;
          color: white;
          border: none;
          border-radius: 50px;
          font-size: clamp(14px, 5vw, 18px);
          font-weight: bold;
          cursor: pointer;
          display: flex;
          align-items: center;
          min-width: 160px;
          justify-content: center;
        ">
          <svg xmlns="http://www.w3.org/2000/svg" width="clamp(16px, 5vw, 24px)" height="clamp(16px, 5vw, 24px)" fill="currentColor" viewBox="0 0 16 16" style="margin-right: 10px;">
            <path d="M0 5a2 2 0 0 1 2-2h7.5a2 2 0 0 1 1.983 1.738l3.11-1.382A1 1 0 0 1 16 4.269v7.462a1 1 0 0 1-1.406.913l-3.111-1.382A2 2 0 0 1 9.5 13H2a2 2 0 0 1-2-2V5z"/>
          </svg>
          Принять
        </button>
        <button id="decline-call" style="
          padding: clamp(10px, 3vw, 15px) clamp(20px, 6vw, 30px);
          background-color: #dc3545;
          color: white;
          border: none;
          border-radius: 50px;
          font-size: clamp(14px, 5vw, 18px);
          font-weight: bold;
          cursor: pointer;
          display: flex;
          align-items: center;
          min-width: 160px;
          justify-content: center;
        ">
          <svg xmlns="http://www.w3.org/2000/svg" width="clamp(16px, 5vw, 24px)" height="clamp(16px, 5vw, 24px)" fill="currentColor" viewBox="0 0 16 16" style="margin-right: 10px;">
            <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
            <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
          </svg>
          Отклонить
        </button>
      </div>
    </div>
    <style>
      @keyframes pulse {
        0% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.2); opacity: 0.8; }
        100% { transform: scale(1); opacity: 1; }
      }
      
      @media (max-width: 480px) {
        #incoming-call-overlay > div {
          padding: 10px;
        }
        #accept-call, #decline-call {
          margin-bottom: 10px;
        }
      }
    </style>
  `;

  // Добавляем оверлей в DOM
  document.body.appendChild(overlay);

  // Запускаем сирену при показе оверлея
  playSiren().catch(console.error);

  // Добавляем обработчики событий
  document.getElementById('accept-call').addEventListener('click', () => {
    stopSiren();
    document.body.removeChild(overlay);
    if (onAccept && typeof onAccept === 'function') {
      onAccept();
    }
  });

  document.getElementById('decline-call').addEventListener('click', () => {
    stopSiren();
    document.body.removeChild(overlay);
    if (onDecline && typeof onDecline === 'function') {
      onDecline();
    }
  });

  // Возвращаем функцию для закрытия оверлея
  return () => {
    if (document.body.contains(overlay)) {
      stopSiren();
      document.body.removeChild(overlay);
    }
  };
}; 