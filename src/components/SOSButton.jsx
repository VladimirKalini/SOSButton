import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';

export function SOSButton({ token, userPhone, serverUrl = 'https://1fxpro.vip' }) {
  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const streamRef = useRef(null);
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [sosId, setSosId] = useState(null);
  const [location, setLocation] = useState(null);
  const [backgroundMode, setBackgroundMode] = useState(false);
  const wakeLockRef = useRef(null);
  const [debugMessage, setDebugMessage] = useState('');
  const [iceCandidates, setIceCandidates] = useState([]);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const maxReconnectAttempts = 3;
  const [signalingState, setSignalingState] = useState('stable');

  // Функция для логирования
  const addDebugMessage = (message) => {
    console.log(message);
    setDebugMessage(message);
  };

  useEffect(() => {
    socketRef.current = io(serverUrl, { 
      auth: { token }, 
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 30000,
      upgrade: true
    });

    socketRef.current.on('connect', () => {
      console.log('Socket.IO подключен');
    });

    socketRef.current.on('connect_error', (err) => {
      console.error('Ошибка подключения Socket.IO:', err);
      setError('Не удалось подключиться к серверу');
    });
    
    socketRef.current.on('sos-answer', async ({ answer }) => { 
      try {
        console.log('Получен ответ SOS:', answer);
        addDebugMessage('Получен ответ от охраны');
        
        if (peerRef.current) {
          // Проверяем текущее состояние соединения
          const currentState = peerRef.current.signalingState;
          setSignalingState(currentState);
          console.log('Текущее состояние сигнализации:', currentState);
          
          try {
            // Проверяем, не находимся ли мы в состоянии stable
            if (currentState === 'stable') {
              console.log('Сброс соединения перед установкой remoteDescription, так как состояние stable');
              // Создаем новый offer для изменения состояния
              const newOffer = await peerRef.current.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
              });
              await peerRef.current.setLocalDescription(newOffer);
              console.log('Создан новый offer для изменения состояния');
              
              // Отправляем новый offer на сервер
              socketRef.current.emit('sos-offer', { 
                offer: newOffer, 
                latitude: location?.latitude, 
                longitude: location?.longitude, 
                phone: userPhone,
                reconnect: true,
                sosId: sosId
              });
              
              console.log('Новый offer отправлен, пропускаем текущий answer');
              return; // Пропускаем текущий answer, так как отправили новый offer
            }
            
            // Устанавливаем remoteDescription
            await peerRef.current.setRemoteDescription(new RTCSessionDescription(answer));
            console.log('Remote description установлен успешно');
            addDebugMessage('Соединение установлено');
            
            // Отправляем сохраненные ICE кандидаты после установки remoteDescription
            if (sosId) {
              iceCandidates.forEach(candidate => {
                socketRef.current.emit('ice-candidate', { candidate, id: sosId });
                console.log('Отправлен сохраненный ICE кандидат');
              });
              setIceCandidates([]);
            }
            
            // Проверяем, изменилось ли состояние после установки remoteDescription
            setTimeout(() => {
              if (peerRef.current) {
                const newState = peerRef.current.signalingState;
                console.log('Состояние после установки remoteDescription:', newState);
                
                if (newState === 'have-local-offer' || newState === 'stable' && !peerRef.current.connectionState === 'connected') {
                  console.log('Соединение в неправильном состоянии после установки remoteDescription');
                  addDebugMessage('Проблема с состоянием соединения, пробуем переподключиться');
                  
                  // Принудительно переподключаемся
                  setTimeout(() => {
                    reinitializeConnection();
                  }, 1000);
                }
              }
            }, 2000);
          } catch (error) {
            console.error('Ошибка при установке remoteDescription:', error);
            addDebugMessage(`Ошибка при установке соединения: ${error.message}`);
            
            // Пробуем переподключиться при ошибке
            setTimeout(() => {
              reinitializeConnection();
            }, 1000);
          }
        } else {
          console.error('Не удалось установить remoteDescription: peer не инициализирован');
          addDebugMessage('Ошибка: соединение не инициализировано');
          
          // Пробуем переподключиться
          if (reconnectAttempts < maxReconnectAttempts) {
            addDebugMessage('Попытка переподключения...');
            setTimeout(() => {
              reinitializeConnection();
              setReconnectAttempts(prev => prev + 1);
            }, 2000);
          }
        }
      } catch (e) {
        console.error('Ошибка при установке ответа:', e);
        addDebugMessage(`Ошибка: ${e.message}`);
        
        // Если произошла ошибка, пробуем переинициализировать соединение
        if (reconnectAttempts < maxReconnectAttempts) {
          addDebugMessage('Ошибка соединения. Попытка переподключения...');
          setTimeout(() => {
            reinitializeConnection();
            setReconnectAttempts(prev => prev + 1);
          }, 2000);
        }
      } 
    });
    
    socketRef.current.on('ice-candidate', async (candidate) => {
      try {
        console.log('Получен ICE кандидат:', candidate);
        if (peerRef.current && peerRef.current.remoteDescription) {
          await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
          console.log('ICE кандидат добавлен успешно');
        } else {
          console.warn('Не удалось добавить ICE кандидата: peer не инициализирован или нет remoteDescription');
          // Сохраняем кандидата для последующего добавления
          setIceCandidates(prev => [...prev, candidate]);
        }
      } catch (err) {
        console.error('Ошибка при добавлении ICE кандидата:', err);
      }
    });
    
    socketRef.current.on('sos-canceled', () => {
      console.log('SOS вызов отменен');
      releaseWakeLock();
      stopStreaming();
      setError('SOS вызов был отменен охраной');
    });

    socketRef.current.on('sos-saved', ({ id }) => {
      console.log('SOS сохранен с ID:', id);
      setSosId(id);
      addDebugMessage('SOS сигнал зарегистрирован');
      
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'inactive') {
        startRecording(id);
      }
      
      socketRef.current.emit('join-room', id);
    });

    // Обработка пинга для поддержания соединения
    socketRef.current.on('ping', () => {
      socketRef.current.emit('pong');
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [serverUrl, token]);

  // Отправка сохраненных ICE кандидатов
  useEffect(() => {
    if (sosId && iceCandidates.length > 0 && socketRef.current) {
      iceCandidates.forEach(candidate => {
        socketRef.current.emit('ice-candidate', { candidate, id: sosId });
        console.log('Отправлен сохраненный ICE кандидат после получения sosId');
      });
      setIceCandidates([]);
    }
  }, [sosId, iceCandidates]);

  const startRecording = (id) => {
    try {
      if (!streamRef.current) {
        console.error('Нет медиапотока для записи');
        return;
      }
      
      let options;
      if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
        options = { mimeType: 'video/webm;codecs=vp9,opus' };
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
        options = { mimeType: 'video/webm;codecs=vp8,opus' };
      } else if (MediaRecorder.isTypeSupported('video/webm')) {
        options = { mimeType: 'video/webm' };
      }
      
      mediaRecorderRef.current = new MediaRecorder(streamRef.current, options);
      
      const chunks = [];
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
          
          const formData = new FormData();
          formData.append('videoChunk', new Blob([e.data], { type: 'video/webm' }));
          formData.append('sosId', id);
          
          axios.post('/api/calls/record', formData, {
            headers: { 
              'Content-Type': 'multipart/form-data',
              Authorization: `Bearer ${token}`
            }
          }).then(() => {
            console.log('Видеофрагмент отправлен успешно');
          }).catch(err => {
            console.error('Ошибка при отправке видео:', err);
          });
        }
      };
      
      mediaRecorderRef.current.start(10000);
      console.log('Запись видео начата');
      addDebugMessage('Запись видео начата');
    } catch (err) {
      console.error('Ошибка при запуске записи:', err);
      addDebugMessage(`Ошибка записи: ${err.message}`);
    }
  };

  const requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        console.log('Wake Lock активирован');
        
        wakeLockRef.current.addEventListener('release', () => {
          console.log('Wake Lock был отключен');
        });
      } catch (err) {
        console.error(`Ошибка при запросе Wake Lock: ${err.name}, ${err.message}`);
      }
    } else {
      console.warn('Wake Lock API не поддерживается в этом браузере.');
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release()
        .then(() => {
          wakeLockRef.current = null;
        })
        .catch((err) => {
          console.error(`Ошибка при освобождении Wake Lock: ${err.name}, ${err.message}`);
        });
    }
  };

  const stopStreaming = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      console.log('Запись остановлена');
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log(`Трек ${track.kind} остановлен`);
      });
      streamRef.current = null;
    }
    
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
      console.log('WebRTC соединение закрыто');
    }
    
    setSending(false);
    setStreaming(false);
    setSosId(null);
    setLocation(null);
    setBackgroundMode(false);
    setIceCandidates([]);
    setReconnectAttempts(0);
    setSignalingState('stable');
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && streaming) {
        setBackgroundMode(true);
      } else if (document.visibilityState === 'visible' && backgroundMode) {
        setBackgroundMode(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [streaming, backgroundMode]);

  // Инициализация WebRTC соединения
  const initializeWebRTC = async () => {
    try {
      if (peerRef.current) {
        peerRef.current.close();
      }
      
      peerRef.current = new RTCPeerConnection({ 
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' }
        ],
        iceTransportPolicy: 'all',
        iceCandidatePoolSize: 10
      });
      
      peerRef.current.onicecandidate = ({ candidate }) => {
        if (candidate) {
          console.log('Сгенерирован ICE кандидат:', candidate);
          
          if (sosId) {
            socketRef.current.emit('ice-candidate', { candidate, id: sosId });
            console.log('ICE кандидат отправлен напрямую');
          } else {
            setIceCandidates(prev => [...prev, candidate]);
            console.log('ICE кандидат сохранен для последующей отправки');
          }
        }
      };
      
      peerRef.current.oniceconnectionstatechange = () => {
        const state = peerRef.current.iceConnectionState;
        console.log('ICE состояние:', state);
        
        if (state === 'connected' || state === 'completed') {
          addDebugMessage('Соединение установлено');
          setReconnectAttempts(0);
        } else if (state === 'failed') {
          addDebugMessage('Соединение не удалось');
          if (reconnectAttempts < maxReconnectAttempts) {
            addDebugMessage('Попытка восстановления соединения...');
            peerRef.current.restartIce();
            setReconnectAttempts(prev => prev + 1);
          }
        } else if (state === 'disconnected') {
          addDebugMessage('Соединение прервано');
        }
      };
      
      peerRef.current.onsignalingstatechange = () => {
        const state = peerRef.current.signalingState;
        console.log('Signaling состояние:', state);
        setSignalingState(state);
      };
      
      peerRef.current.onconnectionstatechange = () => {
        console.log('Connection состояние:', peerRef.current.connectionState);
        if (peerRef.current.connectionState === 'connected') {
          addDebugMessage('Соединение установлено');
        } else if (peerRef.current.connectionState === 'failed') {
          addDebugMessage('Соединение не удалось');
        }
      };
      
      // Добавляем все треки в peer connection
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          const sender = peerRef.current.addTrack(track, streamRef.current);
          console.log(`Трек добавлен: ${track.kind}, enabled: ${track.enabled}`);
        });
      } else {
        throw new Error('Медиапоток не инициализирован');
      }
      
      // Создаем offer
      const offer = await peerRef.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      await peerRef.current.setLocalDescription(offer);
      console.log('Local description установлен:', offer);
      setSignalingState(peerRef.current.signalingState);
      
      return offer;
    } catch (err) {
      console.error('Ошибка при инициализации WebRTC:', err);
      throw err;
    }
  };

  // Переинициализация соединения
  const reinitializeConnection = async () => {
    if (!location || !socketRef.current) return;
    
    try {
      addDebugMessage('Переинициализация соединения...');
      
      // Закрываем текущее соединение
      if (peerRef.current) {
        peerRef.current.close();
        peerRef.current = null;
      }
      
      // Очищаем видеопоток, если он есть
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
        });
      }
      
      // Получаем новый доступ к камере
      addDebugMessage('Получение нового доступа к камере...');
      await initializeMedia();
      
      // Создаем новое WebRTC соединение
      addDebugMessage('Создание нового WebRTC соединения...');
      const offer = await initializeWebRTC();
      
      // Отправляем новый offer
      addDebugMessage('Отправка нового SOS сигнала...');
      socketRef.current.emit('sos-offer', { 
        offer, 
        latitude: location.latitude, 
        longitude: location.longitude, 
        phone: userPhone,
        reconnect: true,
        sosId: sosId // Отправляем существующий ID, если есть
      });
      
      // Сбрасываем состояние сигнализации
      setSignalingState('new');
      
      addDebugMessage('Новый SOS сигнал отправлен');
    } catch (err) {
      console.error('Ошибка при переинициализации соединения:', err);
      addDebugMessage(`Ошибка переподключения: ${err.message}`);
      
      // В случае ошибки, пробуем еще раз через некоторое время
      if (reconnectAttempts < maxReconnectAttempts) {
        addDebugMessage(`Повторная попытка через 3 секунды (${reconnectAttempts + 1}/${maxReconnectAttempts})...`);
        setTimeout(() => {
          setReconnectAttempts(prev => prev + 1);
          reinitializeConnection();
        }, 3000);
      } else {
        addDebugMessage('Достигнуто максимальное количество попыток переподключения');
      }
    }
  };

  // Инициализация медиапотоков
  const initializeMedia = async () => {
    try {
      const constraints = { 
        video: { 
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }, 
        audio: true 
      };
      
      try {
        streamRef.current = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('Доступ к основной камере получен');
      } catch (err) {
        console.error('Ошибка при запросе основной камеры:', err);
        
        // Пробуем получить доступ к любой камере
        constraints.video = true;
        streamRef.current = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('Доступ к фронтальной камере получен');
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.muted = true;
        
        // Проверяем, что видео действительно воспроизводится
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().catch(err => {
            console.error('Ошибка воспроизведения видео:', err);
          });
        };
      }
      
      return streamRef.current;
    } catch (err) {
      console.error('Ошибка при инициализации медиа:', err);
      throw err;
    }
  };

  const handleSOS = async () => {
    if (sending && sosId) {
      try {
        await axios.delete(`/api/calls/${sosId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        releaseWakeLock();
        stopStreaming();
        return;
      } catch (err) {
        setError('Не удалось отменить SOS вызов');
        console.error(err);
        return;
      }
    }

    setError('');
    addDebugMessage('Инициализация SOS...');
    setSending(true);
    setIceCandidates([]);
    setReconnectAttempts(0);
    setSignalingState('stable');

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const { latitude, longitude } = coords;
        setLocation({ latitude, longitude });
        addDebugMessage('Геолокация получена');
        
        try {
          await requestWakeLock();
          
          addDebugMessage('Запрашиваем доступ к камере...');
          await initializeMedia();
          addDebugMessage('Доступ к камере получен');
          
          addDebugMessage('Инициализация WebRTC соединения...');
          const offer = await initializeWebRTC();
          
          addDebugMessage('Отправка SOS сигнала...');
          socketRef.current.emit('sos-offer', { 
            offer, 
            latitude, 
            longitude, 
            phone: userPhone 
          });
          
          setStreaming(true);
          addDebugMessage('SOS сигнал отправлен');
        } catch (err) {
          setError(`Не удалось запустить камеру или соединение: ${err.message}`);
          setSending(false);
          console.error('Ошибка при инициализации SOS:', err);
          
          // Освобождаем ресурсы при ошибке
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
          }
          if (peerRef.current) {
            peerRef.current.close();
          }
        }
      }, 
      (err) => {
        setError('Не удалось получить геолокацию');
        setSending(false);
        console.error('Ошибка геолокации:', err);
      }, 
      { 
        enableHighAccuracy: true, 
        timeout: 10000, 
        maximumAge: 0 
      }
    );
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      gap: '1.5rem',
      padding: '2rem',
      maxWidth: '400px',
      margin: '0 auto'
    }}>
      {error && (
        <div style={{ 
          color: 'white', 
          backgroundColor: '#dc3545', 
          padding: '1rem 1.25rem', 
          borderRadius: '0.5rem',
          width: '100%',
          boxShadow: '0 4px 6px rgba(220, 53, 69, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: '500'
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16" style={{ marginRight: '0.5rem' }}>
            <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
            <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/>
          </svg>
          {error}
        </div>
      )}
      
      <button
        onClick={handleSOS}
        style={{
          fontSize: '1.75rem',
          fontWeight: 'bold',
          padding: sending ? '3.5rem' : '4rem',
          backgroundColor: sending ? '#dc3545' : '#e53935',
          color: '#fff',
          border: 'none',
          borderRadius: '50%',
          cursor: 'pointer',
          boxShadow: sending 
            ? '0 6px 12px rgba(220, 53, 69, 0.4), inset 0 0 0 4px rgba(255, 255, 255, 0.2)' 
            : '0 8px 16px rgba(229, 57, 53, 0.4), inset 0 0 0 6px rgba(255, 255, 255, 0.2)',
          transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
          position: 'relative',
          overflow: 'hidden',
          transform: sending ? 'scale(0.95)' : 'scale(1)',
          animation: sending ? 'pulse 2s infinite' : 'none'
        }}
      >
        {sending ? 'ОТМЕНА' : 'SOS'}
        <style>{`
          @keyframes pulse {
            0% { box-shadow: 0 0 0 0 rgba(220, 53, 69, 0.7); }
            70% { box-shadow: 0 0 0 15px rgba(220, 53, 69, 0); }
            100% { box-shadow: 0 0 0 0 rgba(220, 53, 69, 0); }
          }
        `}</style>
      </button>
      
      {sending && (
        <div style={{ 
          padding: '1.25rem',
          backgroundColor: '#fff',
          borderRadius: '0.75rem',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          width: '100%',
          marginTop: '1rem',
          border: '1px solid rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{ 
            color: '#28a745', 
            fontWeight: 'bold', 
            marginBottom: '1rem',
            textAlign: 'center',
            fontSize: '1.1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16" style={{ marginRight: '0.5rem' }}>
              <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
            </svg>
            SOS сигнал отправлен
          </div>
          
          {location && (
            <div style={{ 
              marginBottom: '1rem', 
              padding: '0.75rem',
              backgroundColor: '#f8f9fa',
              borderRadius: '0.5rem',
              fontSize: '0.9rem',
              border: '1px solid #e9ecef'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <strong>Широта:</strong> 
                <span>{location.latitude.toFixed(6)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>Долгота:</strong> 
                <span>{location.longitude.toFixed(6)}</span>
              </div>
            </div>
          )}
          
          <div style={{ 
            color: '#dc3545', 
            fontWeight: 'bold',
            marginBottom: '1rem',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.5rem',
            backgroundColor: 'rgba(220, 53, 69, 0.1)',
            borderRadius: '0.5rem'
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style={{ marginRight: '0.5rem' }}>
              <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/>
            </svg>
            {backgroundMode ? 'Запись продолжается в фоновом режиме' : 'Идет запись с камеры'}
          </div>
          
          <div style={{ 
            fontSize: '0.85rem', 
            color: '#6c757d',
            padding: '0.5rem',
            backgroundColor: '#f8f9fa',
            borderRadius: '0.5rem',
            border: '1px solid #e9ecef',
            marginBottom: '0.75rem'
          }}>
            <div style={{ marginBottom: '0.5rem' }}>
              <strong>Статус:</strong> {debugMessage}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>Соединение:</strong> 
              <span style={{ 
                color: signalingState === 'stable' ? '#28a745' : '#ffc107',
                fontWeight: '500'
              }}>
                {signalingState}
              </span>
            </div>
          </div>
          
          {reconnectAttempts > 0 && (
            <div style={{ 
              fontSize: '0.85rem', 
              color: '#dc3545',
              textAlign: 'center',
              marginBottom: '0.75rem',
              padding: '0.5rem',
              backgroundColor: 'rgba(220, 53, 69, 0.1)',
              borderRadius: '0.5rem',
              fontWeight: '500'
            }}>
              Попыток переподключения: {reconnectAttempts} из {maxReconnectAttempts}
            </div>
          )}
          
          {streaming && (
            <button
              onClick={reinitializeConnection}
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: '#007bff',
                color: '#fff',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontWeight: 'bold',
                boxShadow: '0 2px 4px rgba(0, 123, 255, 0.2)',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style={{ marginRight: '0.5rem' }}>
                <path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41zm-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9z"/>
                <path fillRule="evenodd" d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.9A5.002 5.002 0 0 0 8 3zM3.1 9a5.002 5.002 0 0 0 8.757 2.182.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9H3.1z"/>
              </svg>
              Переподключиться
            </button>
          )}
        </div>
      )}
      
      {streaming && !backgroundMode && (
        <div style={{ 
          width: '100%', 
          borderRadius: '0.75rem',
          overflow: 'hidden',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          border: '1px solid rgba(0, 0, 0, 0.05)'
        }}>
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            style={{ 
              width: '100%',
              borderRadius: '0.5rem',
              backgroundColor: '#000'
            }}
          />
        </div>
      )}
    </div>
  );
}
