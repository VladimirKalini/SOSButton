const fs = require('fs');
const path = require('path');

/**
 * Скрипт для полного удаления всех компонентов видеотрансляции и WebRTC
 */

// Список файлов, которые нужно полностью удалить
const filesToDelete = [
  path.join(__dirname, '../scripts/webrtcErrorHandler.js'),
  path.join(__dirname, '../scripts/simpleWebRTC.js')
];

// Удаляем файлы
console.log('Удаление WebRTC-зависимых файлов...');
filesToDelete.forEach(file => {
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
    console.log(`✓ Удален файл: ${path.basename(file)}`);
  } else {
    console.log(`⚠ Файл не найден: ${path.basename(file)}`);
  }
});

// Список файлов, из которых нужно удалить WebRTC-зависимый код
const filesToModify = [
  {
    path: path.join(__dirname, '../components/SOSButton.jsx'),
    replacements: [
      {
        search: /import \{ diagnoseWebRTCError \} from ['"]\.\.\/scripts\/webrtcErrorHandler['"];/g,
        replace: '// WebRTC импорты удалены'
      },
      {
        search: /const peerRef = useRef\(null\);/g,
        replace: '// WebRTC ссылки удалены'
      },
      {
        search: /const streamRef = useRef\(null\);/g,
        replace: '// Видеопоток ссылки удалены'
      },
      {
        search: /const videoRef = useRef\(null\);/g,
        replace: '// Видео ссылки удалены'
      },
      {
        search: /const mediaRecorderRef = useRef\(null\);/g,
        replace: '// MediaRecorder ссылки удалены'
      },
      {
        search: /const \[streaming, setStreaming\] = useState\(false\);/g,
        replace: '// Состояния для видеотрансляции удалены'
      },
      {
        search: /const initializeWebRTC = async \(\) => \{[\s\S]*?\};/g,
        replace: '// Функция initializeWebRTC удалена'
      },
      {
        search: /const initializeMedia = async \(\) => \{[\s\S]*?\};/g,
        replace: `// Функция initializeMedia заменена на заглушку
const initializeMedia = async () => {
  console.log('Функционал видеотрансляции отключен');
  return true;
};`
      },
      {
        search: /const startRecording = \(id\) => \{[\s\S]*?\};/g,
        replace: `// Функция startRecording заменена на заглушку
const startRecording = (id) => {
  console.log('Функционал записи видео отключен');
};`
      },
      {
        search: /const stopStreaming = \(\) => \{[\s\S]*?\};/g,
        replace: `// Функция stopStreaming заменена на заглушку
const stopStreaming = () => {
  console.log('Остановка видеотрансляции не требуется - функционал отключен');
};`
      },
      {
        search: /const diagnosis = diagnoseWebRTCError\(error\);/g,
        replace: 'const diagnosis = "Ошибка в приложении";'
      },
      {
        search: /<video[\s\S]*?<\/video>/g,
        replace: '<!-- Элемент видео удален -->'
      }
    ]
  },
  {
    path: path.join(__dirname, '../components/CallDetails.jsx'),
    replacements: [
      {
        search: /import \{ checkWebRTCSupport[\s\S]*?checkSignalingServer \} from ['"]\.\.\/scripts\/webrtcErrorHandler['"];/g,
        replace: '// WebRTC импорты удалены'
      },
      {
        search: /const peerRef = useRef\(null\);/g,
        replace: '// WebRTC ссылки удалены'
      },
      {
        search: /const localVideoRef = useRef\(null\);/g,
        replace: '// Видео ссылки удалены'
      },
      {
        search: /const remoteVideoRef = useRef\(null\);/g,
        replace: '// Видео ссылки удалены'
      },
      {
        search: /const localStreamRef = useRef\(null\);/g,
        replace: '// Видеопоток ссылки удалены'
      },
      {
        search: /const remoteStreamRef = useRef\(null\);/g,
        replace: '// Видеопоток ссылки удалены'
      },
      {
        search: /\/\/ Инициализация WebRTC[\s\S]*?addDebugInfo\('WebRTC соединение не инициализировано'\);/g,
        replace: '// WebRTC функционал удален'
      },
      {
        search: /const handleDiagnoseWebRTC[\s\S]*?\};/g,
        replace: '// Функция диагностики WebRTC удалена'
      },
      {
        search: /<video[\s\S]*?<\/video>/g,
        replace: '<!-- Элемент видео удален -->'
      },
      {
        search: /<div[^>]*?id="video-container"[\s\S]*?<\/div>/g,
        replace: '<!-- Контейнер видео удален -->'
      }
    ]
  },
  {
    path: path.join(__dirname, '../components/GuardDashboard.jsx'),
    replacements: [
      {
        search: /const \[videoMode, setVideoMode\] = useState\(['"]live['"]\);/g,
        replace: '// Состояние для режима видео удалено'
      },
      {
        search: /<video[\s\S]*?<\/video>/g,
        replace: '<!-- Элемент видео удален -->'
      },
      {
        search: /<div[^>]*?className="video-container"[\s\S]*?<\/div>/g,
        replace: '<!-- Контейнер видео удален -->'
      }
    ]
  },
  {
    path: path.join(__dirname, '../server.js'),
    replacements: [
      {
        search: /\/\/ Обработка WebRTC соединений[\s\S]*?\/\/ Конец обработки WebRTC/g,
        replace: '// WebRTC обработка удалена'
      },
      {
        search: /activeConnections\.set\(socket\.id, \{ type: ['"]client['"], sosId: room, socketId: socket\.id \}\);/g,
        replace: 'activeConnections.set(socket.id, { type: "client", sosId: room, socketId: socket.id });'
      },
      {
        search: /\/\/ Если есть ожидающие ICE кандидаты[\s\S]*?pendingIceCandidates\.delete\(room\);/g,
        replace: '// Обработка ICE кандидатов удалена'
      }
    ]
  }
];

// Модифицируем файлы
console.log('\nУдаление WebRTC-кода из файлов...');
filesToModify.forEach(file => {
  if (fs.existsSync(file.path)) {
    let content = fs.readFileSync(file.path, 'utf8');
    let modified = false;
    
    file.replacements.forEach(replacement => {
      const originalContent = content;
      content = content.replace(replacement.search, replacement.replace);
      if (content !== originalContent) {
        modified = true;
      }
    });
    
    if (modified) {
      fs.writeFileSync(file.path, content);
      console.log(`✓ Модифицирован файл: ${path.basename(file.path)}`);
    } else {
      console.log(`⚠ Не найдены паттерны для замены в: ${path.basename(file.path)}`);
    }
  } else {
    console.log(`⚠ Файл не найден: ${path.basename(file.path)}`);
  }
});

// Создаем новый компонент SOSButton без видео
const createNewSOSButton = () => {
  const sosButtonPath = path.join(__dirname, '../components/SOSButton.jsx');
  if (fs.existsSync(sosButtonPath)) {
    console.log('\nСоздание новой версии компонента SOSButton без видеотрансляции...');
    
    const newSOSButton = `import React, { useEffect, useState, useRef } from 'react';
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
      setDebugMessage(\`\${message}: \${diagnosis}\`);
      console.log(\`Диагностика ошибки: \${diagnosis}\`);
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
        await axios.delete(\`/api/calls/\${sosId}/cancel\`, {
          headers: { Authorization: \`Bearer \${token}\` }
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
        \`@keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); background-color: #c82333; }
          100% { transform: scale(1); }
        }\`
      }</style>
    </div>
  );
}`;

    fs.writeFileSync(sosButtonPath, newSOSButton);
    console.log(`✓ Создана новая версия компонента SOSButton без видеотрансляции`);
  }
};

// Создаем новый компонент CallDetails без видео
const createNewCallDetails = () => {
  const callDetailsPath = path.join(__dirname, '../components/CallDetails.jsx');
  if (fs.existsSync(callDetailsPath)) {
    console.log('\nСоздание новой версии компонента CallDetails без видеотрансляции...');
    
    const newCallDetails = `import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import axios from 'axios';
import { useAuth } from '../authContext';

const CallDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [callData, setCallData] = useState(null);
  const [debugInfo, setDebugInfo] = useState([]);
  const socketRef = useRef(null);
  const serverUrl = 'https://1fxpro.vip';

  // Функция для добавления отладочной информации
  const addDebugInfo = (message) => {
    setDebugInfo(prev => [...prev, \`[\${new Date().toLocaleTimeString()}] \${message}\`]);
    console.log(\`[CallDetails] \${message}\`);
  };

  useEffect(() => {
    // Загружаем данные о вызове
    const fetchCallData = async () => {
      try {
        setLoading(true);
        const response = await axios.get(\`/api/calls/\${id}\`, {
          headers: { Authorization: \`Bearer \${token}\` }
        });
        
        setCallData(response.data);
        addDebugInfo(\`Данные вызова загружены: \${response.data.phone}\`);
      } catch (err) {
        console.error('Ошибка при загрузке данных вызова:', err);
        setError('Не удалось загрузить данные вызова');
        addDebugInfo(\`Ошибка загрузки данных: \${err.message}\`);
      } finally {
        setLoading(false);
      }
    };

    fetchCallData();

    // Подключаемся к сокету
    socketRef.current = io(serverUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    socketRef.current.on('connect', () => {
      addDebugInfo('Socket.IO подключен');
      // Присоединяемся к комнате с ID вызова
      socketRef.current.emit('join-room', id);
    });

    socketRef.current.on('connect_error', (err) => {
      addDebugInfo(\`Ошибка подключения Socket.IO: \${err.message}\`);
      setError('Не удалось подключиться к серверу');
    });

    socketRef.current.on('sos-canceled', () => {
      addDebugInfo('SOS вызов отменен');
      setError('Вызов был отменен');
      
      // Показываем уведомление и возвращаемся на главную через 3 секунды
      setTimeout(() => {
        navigate('/');
      }, 3000);
    });

    // Отключаемся при размонтировании
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [id, token, navigate, serverUrl]);

  // Обработчик для завершения вызова
  const handleEndCall = async () => {
    try {
      addDebugInfo('Завершение вызова...');
      
      await axios.delete(\`/api/calls/\${id}/cancel\`, {
        headers: { Authorization: \`Bearer \${token}\` }
      });
      
      addDebugInfo('Вызов успешно завершен');
      navigate('/');
    } catch (err) {
      console.error('Ошибка при завершении вызова:', err);
      addDebugInfo(\`Ошибка завершения вызова: \${err.message}\`);
      setError('Не удалось завершить вызов');
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column'
      }}>
        <div className="spinner" style={{
          width: '50px',
          height: '50px',
          border: '5px solid rgba(0, 123, 255, 0.2)',
          borderRadius: '50%',
          borderTop: '5px solid #007bff',
          animation: 'spin 1s linear infinite'
        }}></div>
        <style>{
          \`@keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }\`
        }</style>
        <p style={{ marginTop: '20px' }}>Загрузка данных вызова...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '20px',
        maxWidth: '600px',
        margin: '0 auto',
        textAlign: 'center'
      }}>
        <div style={{
          backgroundColor: '#f8d7da',
          color: '#721c24',
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          {error}
        </div>
        <button
          onClick={() => navigate('/')}
          style={{
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '10px 20px',
            cursor: 'pointer'
          }}
        >
          Вернуться на главную
        </button>
      </div>
    );
  }

  return (
    <div style={{
      padding: '20px',
      maxWidth: '1200px',
      margin: '0 auto'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h1>Детали вызова</h1>
        <button
          onClick={handleEndCall}
          style={{
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '10px 20px',
            cursor: 'pointer'
          }}
        >
          Завершить вызов
        </button>
      </div>

      {callData && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '20px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
          marginBottom: '20px'
        }}>
          <h2>Информация о вызове</h2>
          <div style={{ marginBottom: '10px' }}>
            <strong>Телефон:</strong> {callData.phone}
          </div>
          {callData.userName && (
            <div style={{ marginBottom: '10px' }}>
              <strong>Имя:</strong> {callData.userName}
            </div>
          )}
          <div style={{ marginBottom: '10px' }}>
            <strong>Время вызова:</strong> {new Date(callData.createdAt).toLocaleString()}
          </div>
          {callData.latitude && callData.longitude && (
            <div style={{ marginBottom: '10px' }}>
              <strong>Координаты:</strong> {callData.latitude}, {callData.longitude}
              <div style={{ marginTop: '10px' }}>
                <a
                  href={\`https://www.google.com/maps?q=\${callData.latitude},\${callData.longitude}\`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    backgroundColor: '#28a745',
                    color: 'white',
                    textDecoration: 'none',
                    padding: '8px 15px',
                    borderRadius: '4px',
                    display: 'inline-block'
                  }}
                >
                  Открыть на карте
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '20px',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        marginBottom: '20px'
      }}>
        <h2>Коммуникация</h2>
        <p>Функция видеосвязи отключена. Используйте телефонную связь для коммуникации с пользователем.</p>
        
        {callData && callData.phone && (
          <a
            href={\`tel:\${callData.phone}\`}
            style={{
              backgroundColor: '#007bff',
              color: 'white',
              textDecoration: 'none',
              padding: '10px 20px',
              borderRadius: '4px',
              display: 'inline-block',
              marginTop: '10px'
            }}
          >
            Позвонить {callData.phone}
          </a>
        )}
      </div>

      <div style={{
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        padding: '15px',
        marginTop: '20px'
      }}>
        <h3>Журнал событий</h3>
        <div style={{
          maxHeight: '200px',
          overflowY: 'auto',
          backgroundColor: '#212529',
          color: '#adb5bd',
          padding: '10px',
          borderRadius: '4px',
          fontFamily: 'monospace',
          fontSize: '14px'
        }}>
          {debugInfo.length === 0 ? (
            <p>Нет событий</p>
          ) : (
            debugInfo.map((info, index) => (
              <div key={index}>{info}</div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default CallDetails;`;

    fs.writeFileSync(callDetailsPath, newCallDetails);
    console.log(`✓ Создана новая версия компонента CallDetails без видеотрансляции`);
  }
};

// Выполняем создание новых компонентов
createNewSOSButton();
createNewCallDetails();

console.log('\nУдаление функционала видеотрансляции завершено!'); 