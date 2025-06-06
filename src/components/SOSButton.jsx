import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';

export function SOSButton({ token, userPhone, serverUrl = 'https://novyy-gorizont-sos.com' }) {
  const socketRef = useRef(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sosId, setSosId] = useState(null);
  const [location, setLocation] = useState(null);
  const [backgroundMode, setBackgroundMode] = useState(false);
  const wakeLockRef = useRef(null);
  const [debugMessage, setDebugMessage] = useState('');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const maxReconnectAttempts = 3;
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);

  // Функция для логирования
  const addDebugMessage = (message, error = null) => {
    console.log(message);
    
    if (error) {
      const diagnosis = "Ошибка в приложении";
      setDebugMessage(`${message}: ${diagnosis}`);
      console.log(`Диагностика ошибки: ${diagnosis}`);
    } else {
      setDebugMessage(message);
    }
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
    
    socketRef.current.on('sos-saved', ({ id }) => {
      console.log('SOS сохранен с ID:', id);
      setSosId(id);
      addDebugMessage('SOS сигнал зарегистрирован');
      
      socketRef.current.emit('join-room', id);
    });

    // Обработка подтверждения отмены SOS сигнала
    socketRef.current.on('sos-cancel-confirmed', ({ id }) => {
      console.log('Получено подтверждение отмены SOS:', id);
      if (id === sosId) {
        setSending(false);
        setSosId(null);
        addDebugMessage('SOS сигнал успешно отменен');
      }
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
  }, [serverUrl, token, sosId]);

  // Добавляем обработчик сообщений от service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const messageHandler = (event) => {
        const { action, success } = event.data || {};
        console.log('Получено сообщение от service worker:', action);
        
        if (action === 'siren-stopped' && success) {
          console.log('Получено подтверждение остановки сирены');
          // Можно добавить дополнительную логику при необходимости
        }
      };
      
      navigator.serviceWorker.addEventListener('message', messageHandler);
      
      return () => {
        navigator.serviceWorker.removeEventListener('message', messageHandler);
      };
    }
  }, []);

  // Запрос WakeLock для предотвращения засыпания устройства
  const requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        console.log('WakeLock получен');
        
        wakeLockRef.current.addEventListener('release', () => {
          console.log('WakeLock освобожден');
          wakeLockRef.current = null;
        });
      } catch (err) {
        console.error('Ошибка получения WakeLock:', err);
      }
    } else {
      console.warn('WakeLock API не поддерживается');
    }
  };
  
  // Освобождение WakeLock
  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release()
        .then(() => {
          console.log('WakeLock освобожден явно');
          wakeLockRef.current = null;
        })
        .catch(err => console.error('Ошибка освобождения WakeLock:', err));
    }
  };

  // Запрос разрешения на геолокацию
  const requestLocationPermission = () => {
    return new Promise((resolve, reject) => {
      if ('geolocation' in navigator) {
        setIsRequestingLocation(true);
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setIsRequestingLocation(false);
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy
            });
          },
          (err) => {
            setIsRequestingLocation(false);
            console.error('Ошибка получения геолокации:', err);
            // Не отклоняем промис, а возвращаем null
            resolve(null);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      } else {
        resolve(null);
      }
    });
  };

  // Обработчик нажатия кнопки SOS
  const handleSOS = async () => {
    try {
      // Если уже отправляем, не делаем ничего
      if (sending) return;
      
      // Если уже есть активный SOS, показываем сообщение
      if (sosId) {
        addDebugMessage('У вас уже есть активный SOS сигнал');
        return;
      }
      
      setSending(true);
      setError('');
      addDebugMessage('Отправка SOS сигнала...');
      
      // Запрашиваем WakeLock
      await requestWakeLock();
      
      // Получаем геолокацию
      let userLocation = await requestLocationPermission();
      
      if (userLocation) {
        setLocation(userLocation);
        console.log('Геолокация получена:', userLocation);
      } else {
        // Если не удалось получить геолокацию, используем нулевые координаты
        userLocation = { latitude: 0, longitude: 0, accuracy: 0 };
        addDebugMessage('Не удалось получить геолокацию. SOS будет отправлен без координат.');
      }
      
      // Проверяем соединение с сервером
      if (!socketRef.current || !socketRef.current.connected) {
        addDebugMessage('Переподключение к серверу...');
        
        // Пробуем переподключиться
        if (socketRef.current) {
          socketRef.current.connect();
        }
        
        // Ждем 2 секунды для переподключения
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Проверяем, удалось ли подключиться
        if (!socketRef.current || !socketRef.current.connected) {
          throw new Error('Не удалось подключиться к серверу');
        }
      }
      
      // Отправляем SOS сигнал
      socketRef.current.emit('sos-offer', {
        phone: userPhone,
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        timestamp: new Date().toISOString()
      });
      
      addDebugMessage('SOS сигнал отправлен');
      
      // Через 30 секунд автоматически останавливаем отправку, если не получили ответ
      setTimeout(() => {
        if (sending && !sosId) {
          setSending(false);
          setError('Превышено время ожидания ответа от сервера');
          releaseWakeLock();
        }
      }, 30000);
    } catch (err) {
      console.error('Ошибка при отправке SOS:', err);
      setError(`Ошибка при отправке SOS сигнала: ${err.message}`);
      setSending(false);
      releaseWakeLock();
    }
  };

  // Отмена SOS сигнала
  const handleCancelSOS = async () => {
    try {
      // Показываем сообщение о процессе отмены
      addDebugMessage('Отменяем SOS сигнал...');
      
      // Останавливаем звук сирены через service worker
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          action: 'stop-siren'
        });
        console.log('Отправлен запрос на остановку сирены через service worker');
      }
      
      // Останавливаем вибрацию на мобильных устройствах
      if ('vibrate' in navigator) {
        try {
          navigator.vibrate(0); // 0 останавливает вибрацию
          console.log('Вибрация остановлена');
        } catch (err) {
          console.error('Ошибка остановки вибрации:', err);
        }
      }
      
      if (sosId) {
        // Отправляем событие отмены через сокет для немедленного уведомления охраны
        if (socketRef.current && socketRef.current.connected) {
          socketRef.current.emit('cancel-sos', { id: sosId });
          console.log('Отправлено событие отмены SOS через сокет');
        }
        
        // Отправляем запрос на отмену через REST API
        try {
          await axios.delete(`/api/calls/${sosId}/cancel`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          console.log('SOS сигнал отменен через REST API');
        } catch (apiError) {
          console.error('Ошибка отмены через API:', apiError);
          
          // Если не удалось отменить через API, повторно пробуем через сокет
          if (socketRef.current && socketRef.current.connected) {
            console.log('Повторная попытка отмены через сокет');
            socketRef.current.emit('cancel-sos', { id: sosId });
          } else {
            throw apiError; // Пробрасываем ошибку, если оба метода не сработали
          }
        }
      }
      
      // Сбрасываем состояние даже если нет sosId
      setSending(false);
      setSosId(null);
      releaseWakeLock();
      addDebugMessage('SOS сигнал отменен');
      
      // Очищаем ошибки, которые могли быть
      setError('');
    } catch (err) {
      console.error('Ошибка при отмене SOS:', err);
      setError('Не удалось отменить SOS сигнал. Пожалуйста, попробуйте еще раз.');
      
      // Даже при ошибке отправки на сервер, сбрасываем состояние отправки через 3 секунды
      // Это даст пользователю возможность увидеть ошибку и попробовать снова
      setTimeout(() => {
        setSending(false);
        addDebugMessage('Состояние сброшено после ошибки');
      }, 3000);
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      height: '100%'
    }}>
      {error && (
        <div style={{
          backgroundColor: '#f8d7da',
          color: '#721c24',
          padding: '12px',
          borderRadius: '8px',
          marginBottom: '20px',
          width: '100%',
          textAlign: 'center'
        }}>
          {error}
        </div>
      )}
      
      {debugMessage && (
        <div style={{
          backgroundColor: '#d1ecf1',
          color: '#0c5460',
          padding: '8px',
          borderRadius: '8px',
          marginBottom: '20px',
          width: '100%',
          fontSize: '14px',
          textAlign: 'center'
        }}>
          {debugMessage}
        </div>
      )}
      
      {isRequestingLocation ? (
        <div style={{
          backgroundColor: '#fff3cd',
          color: '#856404',
          padding: '12px',
          borderRadius: '8px',
          marginBottom: '20px',
          width: '100%',
          textAlign: 'center'
        }}>
          Запрашиваем разрешение на доступ к геолокации...
        </div>
      ) : null}
      
      <button
        onClick={sending ? handleCancelSOS : handleSOS}
        style={{
          width: '200px',
          height: '200px',
          borderRadius: '50%',
          backgroundColor: sending ? '#dc3545' : '#ff3b30',
          color: 'white',
          fontSize: '24px',
          fontWeight: 'bold',
          border: 'none',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.2s, background-color 0.3s',
          animation: sending ? 'pulse 1.5s infinite' : 'none'
        }}
      >
        {sending ? 'ОТМЕНА' : 'SOS'}
      </button>
      
      {location && (
        <div style={{
          marginTop: '20px',
          fontSize: '14px',
          color: '#6c757d',
          textAlign: 'center'
        }}>
          Ваши координаты: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
        </div>
      )}
      
      <style jsx>{
        `@keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); background-color: #c82333; }
          100% { transform: scale(1); }
        }`
      }</style>
    </div>
  );
}