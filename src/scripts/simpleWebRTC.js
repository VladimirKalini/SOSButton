/**
 * Упрощенная версия WebRTC для более надежной работы
 */

// Базовая конфигурация STUN/TURN серверов
const DEFAULT_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' }
  ],
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
  iceTransportPolicy: 'all'
};

/**
 * Создает новое WebRTC соединение
 * @param {Object} config - Конфигурация WebRTC
 * @returns {RTCPeerConnection} - Новое соединение
 */
export const createPeerConnection = (config = {}) => {
  try {
    // Объединяем пользовательскую конфигурацию с дефолтной
    const finalConfig = { ...DEFAULT_CONFIG, ...config };
    return new RTCPeerConnection(finalConfig);
  } catch (error) {
    console.error('Ошибка при создании WebRTC соединения:', error);
    throw error;
  }
};

/**
 * Создает offer для WebRTC соединения
 * @param {RTCPeerConnection} peerConnection - WebRTC соединение
 * @returns {Promise<RTCSessionDescription>} - Созданный offer
 */
export const createOffer = async (peerConnection) => {
  try {
    if (!peerConnection) {
      throw new Error('PeerConnection не инициализирован');
    }
    
    const offer = await peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    });
    
    await peerConnection.setLocalDescription(offer);
    return offer;
  } catch (error) {
    console.error('Ошибка при создании offer:', error);
    throw error;
  }
};

/**
 * Создает answer для WebRTC соединения
 * @param {RTCPeerConnection} peerConnection - WebRTC соединение
 * @param {RTCSessionDescription} offer - Полученный offer
 * @returns {Promise<RTCSessionDescription>} - Созданный answer
 */
export const createAnswer = async (peerConnection, offer) => {
  try {
    if (!peerConnection) {
      throw new Error('PeerConnection не инициализирован');
    }
    
    if (!offer || !offer.type || !offer.sdp) {
      throw new Error('Некорректный формат offer');
    }
    
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    
    const answer = await peerConnection.createAnswer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    });
    
    await peerConnection.setLocalDescription(answer);
    return answer;
  } catch (error) {
    console.error('Ошибка при создании answer:', error);
    throw error;
  }
};

/**
 * Устанавливает answer для WebRTC соединения
 * @param {RTCPeerConnection} peerConnection - WebRTC соединение
 * @param {RTCSessionDescription} answer - Полученный answer
 * @returns {Promise<void>}
 */
export const setRemoteAnswer = async (peerConnection, answer) => {
  try {
    if (!peerConnection) {
      throw new Error('PeerConnection не инициализирован');
    }
    
    if (!answer || !answer.type || !answer.sdp) {
      throw new Error('Некорректный формат answer');
    }
    
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  } catch (error) {
    console.error('Ошибка при установке answer:', error);
    throw error;
  }
};

/**
 * Добавляет ICE кандидата
 * @param {RTCPeerConnection} peerConnection - WebRTC соединение
 * @param {RTCIceCandidate} candidate - ICE кандидат
 * @returns {Promise<void>}
 */
export const addIceCandidate = async (peerConnection, candidate) => {
  try {
    if (!peerConnection) {
      throw new Error('PeerConnection не инициализирован');
    }
    
    if (!peerConnection.remoteDescription) {
      throw new Error('RemoteDescription не установлен');
    }
    
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (error) {
    console.error('Ошибка при добавлении ICE кандидата:', error);
    throw error;
  }
};

/**
 * Закрывает WebRTC соединение и освобождает ресурсы
 * @param {RTCPeerConnection} peerConnection - WebRTC соединение
 * @param {MediaStream} stream - Медиапоток
 */
export const closeConnection = (peerConnection, stream) => {
  try {
    // Останавливаем все треки
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
      });
    }
    
    // Закрываем соединение
    if (peerConnection) {
      peerConnection.ontrack = null;
      peerConnection.onicecandidate = null;
      peerConnection.oniceconnectionstatechange = null;
      peerConnection.onsignalingstatechange = null;
      peerConnection.onconnectionstatechange = null;
      peerConnection.close();
    }
  } catch (error) {
    console.error('Ошибка при закрытии соединения:', error);
  }
};

/**
 * Получает медиапоток с учетом особенностей iOS
 * @param {Object} constraints - Ограничения для медиапотока
 * @returns {Promise<MediaStream>} - Медиапоток
 */
export const getMediaStream = async (constraints = { video: true, audio: true }) => {
  try {
    // Проверяем, что мы на iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    
    if (isIOS) {
      console.log('Обнаружена iOS платформа, используем специальный подход для запроса разрешений');
      
      // Сначала запрашиваем только аудио
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('Доступ к аудио получен на iOS');
      
      // Затем запрашиваем видео
      const videoConstraints = constraints.video === true 
        ? { facingMode: { ideal: 'environment' } } 
        : constraints.video;
      
      const videoStream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
      console.log('Доступ к видео получен на iOS');
      
      // Объединяем треки из обоих потоков
      const combinedStream = new MediaStream();
      audioStream.getAudioTracks().forEach(track => combinedStream.addTrack(track));
      videoStream.getVideoTracks().forEach(track => combinedStream.addTrack(track));
      
      return combinedStream;
    } else {
      // Стандартный подход для других платформ
      return await navigator.mediaDevices.getUserMedia(constraints);
    }
  } catch (error) {
    console.error('Ошибка при получении медиапотока:', error);
    throw error;
  }
}; 