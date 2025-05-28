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