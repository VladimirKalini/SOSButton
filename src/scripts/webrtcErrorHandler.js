/**
 * Утилиты для обработки и диагностики ошибок WebRTC
 */

/**
 * Проверяет поддержку WebRTC в текущем браузере
 * @returns {Object} Объект с информацией о поддержке WebRTC
 */
export const checkWebRTCSupport = () => {
  const result = {
    supported: false,
    mediaDevices: false,
    peerConnection: false,
    getUserMedia: false,
    mediaRecorder: false,
    details: {}
  };
  
  // Проверка основных API
  result.mediaDevices = !!(navigator.mediaDevices);
  result.getUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  result.peerConnection = !!window.RTCPeerConnection;
  result.mediaRecorder = !!window.MediaRecorder;
  
  // Общая поддержка
  result.supported = result.mediaDevices && result.peerConnection && result.getUserMedia;
  
  // Дополнительная информация
  result.details = {
    browser: navigator.userAgent,
    isSecureContext: window.isSecureContext,
    isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream,
    isAndroid: /Android/.test(navigator.userAgent),
    isChrome: /Chrome/.test(navigator.userAgent) && !/Edge/.test(navigator.userAgent),
    isFirefox: /Firefox/.test(navigator.userAgent),
    isSafari: /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)
  };
  
  return result;
};

/**
 * Диагностирует ошибку WebRTC и возвращает понятное описание
 * @param {Error} error - Объект ошибки
 * @returns {String} Понятное описание ошибки
 */
export const diagnoseWebRTCError = (error) => {
  if (!error) return 'Неизвестная ошибка';
  
  // Стандартные ошибки getUserMedia
  if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
    return 'Камера или микрофон не найдены. Проверьте подключение устройств.';
  }
  
  if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
    return 'Доступ к камере или микрофону запрещен. Пожалуйста, разрешите доступ в настройках браузера.';
  }
  
  if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
    return 'Не удалось получить доступ к камере или микрофону. Возможно, они используются другим приложением.';
  }
  
  if (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError') {
    return 'Не удалось найти устройство, соответствующее указанным требованиям.';
  }
  
  if (error.name === 'TypeError') {
    return 'Некорректные параметры для доступа к медиа устройствам.';
  }
  
  // Ошибки WebRTC
  if (error.message && error.message.includes('setRemoteDescription')) {
    return 'Не удалось установить соединение: ошибка при установке удаленного описания. Возможно, соединение было разорвано или формат данных некорректен.';
  }
  
  if (error.message && error.message.includes('ICE')) {
    return 'Проблема с установлением P2P соединения. Возможно, блокировка на уровне сети или брандмауэра.';
  }
  
  // Общие ошибки
  if (error.message && error.message.includes('peerConnection')) {
    return 'Проблема с WebRTC соединением. Попробуйте перезагрузить страницу.';
  }
  
  // Возвращаем исходное сообщение, если не смогли диагностировать
  return error.message || 'Неизвестная ошибка WebRTC';
};

/**
 * Проверяет сетевое соединение для WebRTC
 * @returns {Promise<Object>} Результаты проверки
 */
export const checkNetworkForWebRTC = async () => {
  const result = {
    online: navigator.onLine,
    stunReachable: false,
    turnReachable: false,
    details: {}
  };
  
  // Проверка STUN сервера
  try {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    
    let stunPromiseResolved = false;
    
    const stunPromise = new Promise((resolve) => {
      pc.onicecandidate = (e) => {
        if (e.candidate && e.candidate.type === 'srflx') {
          stunPromiseResolved = true;
          resolve(true);
        }
      };
    });
    
    // Создаем data channel для запуска ICE
    pc.createDataChannel('testChannel');
    
    // Создаем offer для запуска ICE
    await pc.createOffer().then(offer => pc.setLocalDescription(offer));
    
    // Ждем результат или таймаут
    const timeoutPromise = new Promise(resolve => setTimeout(() => {
      if (!stunPromiseResolved) resolve(false);
    }, 5000));
    
    result.stunReachable = await Promise.race([stunPromise, timeoutPromise]);
    
    // Закрываем соединение
    pc.close();
  } catch (err) {
    console.error('Ошибка при проверке STUN:', err);
    result.details.stunError = err.message;
  }
  
  return result;
};

/**
 * Собирает отладочную информацию о состоянии WebRTC
 * @param {RTCPeerConnection} peerConnection - Объект соединения
 * @returns {Object} Отладочная информация
 */
export const getWebRTCDebugInfo = (peerConnection) => {
  if (!peerConnection) {
    return { error: 'Соединение не инициализировано' };
  }
  
  return {
    iceConnectionState: peerConnection.iceConnectionState,
    iceGatheringState: peerConnection.iceGatheringState,
    signalingState: peerConnection.signalingState,
    connectionState: peerConnection.connectionState,
    timestamp: new Date().toISOString()
  };
};

/**
 * Проверяет и исправляет распространенные проблемы с WebRTC
 * @param {RTCPeerConnection} peerConnection - Объект соединения
 * @returns {Object} Результат проверки и исправления
 */
export const fixCommonWebRTCIssues = (peerConnection) => {
  const result = {
    fixed: false,
    actions: []
  };
  
  if (!peerConnection) {
    return { ...result, error: 'Соединение не инициализировано' };
  }
  
  // Проверка состояния ICE соединения
  if (peerConnection.iceConnectionState === 'failed' || 
      peerConnection.iceConnectionState === 'disconnected') {
    
    try {
      // Попытка перезапустить ICE
      peerConnection.restartIce();
      result.actions.push('Перезапущен процесс ICE соединения');
      result.fixed = true;
    } catch (err) {
      result.actions.push(`Не удалось перезапустить ICE: ${err.message}`);
    }
  }
  
  return result;
};

/**
 * Проверяет порты, необходимые для WebRTC
 * @returns {Promise<Object>} Результаты проверки портов
 */
export const checkWebRTCPorts = async () => {
  const result = {
    udpBlocked: false,
    stunPortsBlocked: false,
    turnPortsBlocked: false,
    details: {}
  };
  
  try {
    // Создаем временное соединение для проверки
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },  // Стандартный STUN порт 19302
        { urls: 'stun:stun1.l.google.com:3478' },  // Альтернативный STUN порт 3478
        { 
          urls: 'turn:turn.anyfirewall.com:443?transport=tcp', // TURN через TCP на порту 443
          username: 'webrtc',
          credential: 'webrtc'
        },
        { 
          urls: 'turn:numb.viagenie.ca:3478', // TURN через UDP на порту 3478
          username: 'webrtc@live.com',
          credential: 'muazkh'
        }
      ]
    });
    
    // Отслеживаем типы кандидатов
    const candidateTypes = {
      host: false,
      srflx: false, // STUN
      relay: false  // TURN
    };
    
    // Отслеживаем порты
    const ports = {
      udp: new Set(),
      tcp: new Set()
    };
    
    // Ожидаем сбор ICE кандидатов
    await new Promise((resolve) => {
      const timeout = setTimeout(resolve, 5000); // Таймаут 5 секунд
      
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const candidate = event.candidate.candidate;
          
          // Определяем тип кандидата
          if (candidate.includes(' host ')) {
            candidateTypes.host = true;
          } else if (candidate.includes(' srflx ')) {
            candidateTypes.srflx = true;
            
            // Извлекаем порт из кандидата
            const parts = candidate.split(' ');
            if (parts.length > 5) {
              const port = parseInt(parts[5], 10);
              if (candidate.includes(' UDP ')) {
                ports.udp.add(port);
              } else if (candidate.includes(' TCP ')) {
                ports.tcp.add(port);
              }
            }
          } else if (candidate.includes(' relay ')) {
            candidateTypes.relay = true;
            
            // Извлекаем порт из кандидата
            const parts = candidate.split(' ');
            if (parts.length > 5) {
              const port = parseInt(parts[5], 10);
              if (candidate.includes(' UDP ')) {
                ports.udp.add(port);
              } else if (candidate.includes(' TCP ')) {
                ports.tcp.add(port);
              }
            }
          }
        } else if (event.candidate === null) {
          // Сбор кандидатов завершен
          clearTimeout(timeout);
          resolve();
        }
      };
      
      // Создаем data channel для запуска ICE
      pc.createDataChannel('testChannel');
      
      // Создаем offer для запуска ICE
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .catch(err => {
          console.error('Ошибка при создании offer:', err);
          clearTimeout(timeout);
          resolve();
        });
    });
    
    // Закрываем соединение
    pc.close();
    
    // Анализируем результаты
    result.udpBlocked = !candidateTypes.host && !candidateTypes.srflx && !candidateTypes.relay;
    result.stunPortsBlocked = !candidateTypes.srflx;
    result.turnPortsBlocked = !candidateTypes.relay;
    
    result.details = {
      candidateTypes,
      ports: {
        udp: Array.from(ports.udp),
        tcp: Array.from(ports.tcp)
      }
    };
    
    return result;
  } catch (err) {
    console.error('Ошибка при проверке портов WebRTC:', err);
    result.error = err.message;
    return result;
  }
};

/**
 * Проверяет соединение с сигнальным сервером
 * @param {string} serverUrl - URL сигнального сервера
 * @returns {Promise<Object>} Результаты проверки
 */
export const checkSignalingServer = async (serverUrl) => {
  const result = {
    connected: false,
    socketId: null,
    error: null
  };
  
  try {
    // Проверяем, доступен ли Socket.IO
    if (!window.io) {
      result.error = 'Socket.IO не доступен';
      return result;
    }
    
    // Пробуем подключиться к серверу
    const socket = window.io(serverUrl, { 
      transports: ['polling', 'websocket'],
      timeout: 5000
    });
    
    // Ожидаем соединение или ошибку
    await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        result.error = 'Таймаут соединения';
        resolve();
      }, 5000);
      
      socket.on('connect', () => {
        result.connected = true;
        result.socketId = socket.id;
        clearTimeout(timeout);
        resolve();
      });
      
      socket.on('connect_error', (err) => {
        result.error = `Ошибка соединения: ${err.message}`;
        clearTimeout(timeout);
        resolve();
      });
    });
    
    // Закрываем соединение
    if (socket) {
      socket.disconnect();
    }
    
    return result;
  } catch (err) {
    result.error = `Непредвиденная ошибка: ${err.message}`;
    return result;
  }
}; 