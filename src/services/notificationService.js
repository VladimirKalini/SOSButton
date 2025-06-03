/**
 * Сервис для работы с уведомлениями и push-сообщениями
 */

import { getPlatform, requestNotificationPermission as requestPermission } from './platformConfig';

// Аудио-контекст для воспроизведения звуков
let audioContext = null;
let sirenSource = null;
let sirenBuffer = null;
let sirenGainNode = null;
let audioElement = null;

/**
 * Инициализирует аудио-контекст для воспроизведения звуков
 * Это необходимо делать после взаимодействия пользователя с страницей
 */
export const initAudioContext = async () => {
  try {
    // Проверяем, поддерживается ли Web Audio API
    if (!window.AudioContext && !window.webkitAudioContext) {
      console.warn('Web Audio API не поддерживается браузером');
      return false;
    }
    
    // Создаем аудио-контекст
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioContextClass();
    
    // Создаем узел усиления
    sirenGainNode = audioContext.createGain();
    sirenGainNode.gain.value = 1.0;
    sirenGainNode.connect(audioContext.destination);
    
    // Загружаем звук сирены
    const response = await fetch('/siren.mp3');
    const arrayBuffer = await response.arrayBuffer();
    sirenBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Для мобильных устройств также подготавливаем HTML5 Audio
    audioElement = document.getElementById('preload-siren') || new Audio('/siren.mp3');
    audioElement.loop = true;
    
    console.log('Аудио-контекст инициализирован успешно');
    return true;
  } catch (err) {
    console.error('Ошибка инициализации аудио-контекста:', err);
    return false;
  }
};

/**
 * Запрашивает разрешение на показ уведомлений
 */
export const requestNotificationPermission = async () => {
  try {
    const granted = await requestPermission();
    console.log(`Разрешение на уведомления ${granted ? 'получено' : 'не получено'}`);
    return granted;
  } catch (err) {
    console.error('Ошибка запроса разрешения на уведомления:', err);
    return false;
  }
};

/**
 * Проигрывает звук сирены
 */
export const playSiren = async () => {
  try {
    // Пробуем использовать Web Audio API
    if (audioContext && sirenBuffer) {
      // Останавливаем предыдущий звук, если он есть
      if (sirenSource) {
        sirenSource.stop();
        sirenSource = null;
      }
      
      // Создаем новый источник звука
      sirenSource = audioContext.createBufferSource();
      sirenSource.buffer = sirenBuffer;
      sirenSource.loop = true;
      sirenSource.connect(sirenGainNode);
      
      // Запускаем воспроизведение
      sirenSource.start(0);
      console.log('Сирена воспроизводится через Web Audio API');
      return true;
    }
    
    // Если Web Audio API не доступен, используем HTML5 Audio
    if (audioElement) {
      // Перезапускаем воспроизведение
      audioElement.currentTime = 0;
      
      // На мобильных устройствах часто требуется пользовательское взаимодействие
      // для воспроизведения звука, поэтому используем Promise
      await audioElement.play();
      console.log('Сирена воспроизводится через HTML5 Audio');
      return true;
    }
    
    console.warn('Не удалось воспроизвести сирену: аудио-контекст не инициализирован');
    return false;
  } catch (err) {
    console.error('Ошибка воспроизведения сирены:', err);
    
    // Пробуем запустить через service worker
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        action: 'play-siren'
      });
      console.log('Отправлен запрос на воспроизведение сирены через service worker');
    }
    
    return false;
  }
};

/**
 * Останавливает звук сирены
 */
export const stopSiren = () => {
  try {
    // Останавливаем Web Audio API
    if (sirenSource) {
      sirenSource.stop();
      sirenSource = null;
      console.log('Сирена остановлена (Web Audio API)');
    }
    
    // Останавливаем HTML5 Audio
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
      console.log('Сирена остановлена (HTML5 Audio)');
    }
    
    // Отправляем сообщение service worker для остановки сирены
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        action: 'stop-siren'
      });
      console.log('Отправлен запрос на остановку сирены через service worker');
    }
    
    return true;
  } catch (err) {
    console.error('Ошибка остановки сирены:', err);
    return false;
  }
};

/**
 * Показывает оверлей входящего вызова
 * @param {Object} data Данные о вызове
 * @param {Function} onAccept Функция, вызываемая при принятии вызова
 * @param {Function} onDecline Функция, вызываемая при отклонении вызова
 * @returns {Function} Функция для закрытия оверлея
 */
export const showIncomingCallOverlay = (data, onAccept, onDecline) => {
  // Создаем элемент оверлея
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.backgroundColor = 'rgba(220, 53, 69, 0.95)';
  overlay.style.zIndex = '9999';
  overlay.style.display = 'flex';
  overlay.style.flexDirection = 'column';
  overlay.style.justifyContent = 'center';
  overlay.style.alignItems = 'center';
  overlay.style.color = 'white';
  overlay.style.fontFamily = 'Arial, sans-serif';
  overlay.style.padding = '20px';
  overlay.style.boxSizing = 'border-box';
  
  // Создаем содержимое оверлея
  const title = document.createElement('h2');
  title.textContent = 'SOS Вызов!';
  title.style.fontSize = '28px';
  title.style.marginBottom = '10px';
  title.style.textAlign = 'center';
  
  const message = document.createElement('p');
  message.textContent = `От: ${data.userName || data.phone || 'Неизвестный пользователь'}`;
  message.style.fontSize = '20px';
  message.style.marginBottom = '30px';
  message.style.textAlign = 'center';
  
  // Создаем контейнер для кнопок
  const buttonContainer = document.createElement('div');
  buttonContainer.style.display = 'flex';
  buttonContainer.style.justifyContent = 'center';
  buttonContainer.style.gap = '20px';
  
  // Кнопка принятия вызова
  const acceptButton = document.createElement('button');
  acceptButton.textContent = 'Принять';
  acceptButton.style.padding = '15px 30px';
  acceptButton.style.fontSize = '18px';
  acceptButton.style.backgroundColor = '#28a745';
  acceptButton.style.color = 'white';
  acceptButton.style.border = 'none';
  acceptButton.style.borderRadius = '5px';
  acceptButton.style.cursor = 'pointer';
  
  // Кнопка отклонения вызова
  const declineButton = document.createElement('button');
  declineButton.textContent = 'Отклонить';
  declineButton.style.padding = '15px 30px';
  declineButton.style.fontSize = '18px';
  declineButton.style.backgroundColor = '#6c757d';
  declineButton.style.color = 'white';
  declineButton.style.border = 'none';
  declineButton.style.borderRadius = '5px';
  declineButton.style.cursor = 'pointer';
  
  // Добавляем обработчики событий
  acceptButton.addEventListener('click', () => {
    document.body.removeChild(overlay);
    if (typeof onAccept === 'function') {
      onAccept(data);
    }
  });
  
  declineButton.addEventListener('click', () => {
    document.body.removeChild(overlay);
    if (typeof onDecline === 'function') {
      onDecline(data);
    }
  });
  
  // Собираем оверлей
  buttonContainer.appendChild(acceptButton);
  buttonContainer.appendChild(declineButton);
  
  overlay.appendChild(title);
  overlay.appendChild(message);
  overlay.appendChild(buttonContainer);
  
  // Добавляем оверлей на страницу
  document.body.appendChild(overlay);
  
  // Запускаем вибрацию на мобильных устройствах
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate([300, 100, 300, 100, 300]);
    } catch (err) {
      console.error('Ошибка активации вибрации:', err);
    }
  }
  
  // Возвращаем функцию для закрытия оверлея
  return () => {
    if (document.body.contains(overlay)) {
      document.body.removeChild(overlay);
    }
  };
};

/**
 * Регистрирует push-подписку для текущего пользователя
 * @param {string} role Роль пользователя ('user' или 'guard')
 * @returns {Promise<Object|null>} Объект с подпиской или null в случае ошибки
 */
export const registerPushSubscription = async (role) => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push-уведомления не поддерживаются браузером');
    return null;
  }
  
  try {
    // Запрашиваем разрешение на уведомления
    const permissionGranted = await requestNotificationPermission();
    if (!permissionGranted) {
      console.warn('Не получено разрешение на уведомления');
      return null;
    }
    
    // Получаем регистрацию service worker
    const registration = await navigator.serviceWorker.ready;
    
    // Проверяем наличие существующей подписки
    let subscription = await registration.pushManager.getSubscription();
    
    // Если подписка существует, возвращаем её
    if (subscription) {
      console.log('Найдена существующая push-подписка');
      return { subscription, isNew: false };
    }
    
    // Получаем VAPID ключ из мета-тега
    const vapidMeta = document.querySelector('meta[name="vapid-key"]');
    if (!vapidMeta) {
      console.error('Не найден мета-тег с VAPID ключом');
      return null;
    }
    
    const vapidKey = vapidMeta.content;
    if (!vapidKey) {
      console.error('VAPID ключ пустой');
      return null;
    }
    
    // Конвертируем VAPID ключ в Uint8Array
    const applicationServerKey = urlBase64ToUint8Array(vapidKey);
    
    // Создаем новую подписку
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey
    });
    
    console.log('Создана новая push-подписка');
    return { subscription, isNew: true };
  } catch (err) {
    console.error('Ошибка регистрации push-подписки:', err);
    return null;
  }
};

/**
 * Конвертирует base64 строку в Uint8Array
 * @param {string} base64String VAPID ключ в формате base64
 * @returns {Uint8Array} Массив байтов для использования в applicationServerKey
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  
  return outputArray;
}

export default {
  initAudioContext,
  requestNotificationPermission,
  playSiren,
  stopSiren,
  showIncomingCallOverlay,
  registerPushSubscription
}; 