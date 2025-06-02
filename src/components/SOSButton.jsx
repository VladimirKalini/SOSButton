import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';

export function SOSButton({ token, userPhone, serverUrl = 'https://1fxpro.vip' }) {
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

  // Обработчик нажатия кнопки SOS
  const handleSOS = async () => {
    try {
      // Если уже отправляем, не делаем ничего
      if (sending) return;
      
      setSending(true);
      setError('');
      addDebugMessage('Отправка SOS сигнала...');
      
      // Запрашиваем WakeLock
      await requestWakeLock();
      
      // Получаем геолокацию
      let userLocation = null;
      try {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          });
        });
        
        userLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        };
        
        setLocation(userLocation);
        console.log('Геолокация получена:', userLocation);
      } catch (err) {
        console.error('Ошибка получения геолокации:', err);
        addDebugMessage('Не удалось получить геолокацию');
      }
      
      // Отправляем SOS сигнал без видео
      socketRef.current.emit('sos-signal', {
        phone: userPhone,
        latitude: userLocation?.latitude,
        longitude: userLocation?.longitude,
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
      setError('Ошибка при отправке SOS сигнала');
      setSending(false);
      releaseWakeLock();
    }
  };

  // Отмена SOS сигнала
  const handleCancelSOS = async () => {
    try {
      if (sosId) {
        await axios.delete(`/api/calls/${sosId}/cancel`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      
      setSending(false);
      setSosId(null);
      releaseWakeLock();
      addDebugMessage('SOS сигнал отменен');
    } catch (err) {
      console.error('Ошибка при отмене SOS:', err);
      setError('Не удалось отменить SOS сигнал');
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