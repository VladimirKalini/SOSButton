// src/components/guard/GuardDashboard.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../authContext';
import { io } from 'socket.io-client';
import { 
  requestNotificationPermission, 
  showIncomingCallOverlay, 
  playSiren, 
  stopSiren, 
  initAudioContext 
} from '../services/notificationService';
import { 
  subscribeToPushNotifications,
  isPushSupported
} from '../services/pushService';

const GuardDashboard = () => {
  const [activeCalls, setActiveCalls] = useState([]);
  const [callHistory, setCallHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('active');
  const [page, setPage] = useState(1);
  const { token, logout } = useAuth();
  const serverUrl = 'https://1fxpro.vip';
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const audioRef = useRef(null);
  const [isSirenPlaying, setIsSirenPlaying] = useState(false);
  const navigate = useNavigate();
  const overlayCloseRef = useRef(null);
  const socketRef = useRef(null);
  const activeCallsRef = useRef([]);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);

  // Обновляем ref при изменении activeCalls
  useEffect(() => {
    activeCallsRef.current = activeCalls;
  }, [activeCalls]);

  useEffect(() => {
    // Запрашиваем разрешение на уведомления при загрузке компонента
    requestNotificationPermission().then(granted => {
      if (granted) {
        // Проверяем поддержку Push API
        const supported = isPushSupported();
        setPushSupported(supported);
        
        if (supported) {
          // Подписываемся на push-уведомления
          subscribeToPushNotifications()
            .then(subscription => {
              if (subscription) {
                setPushEnabled(true);
                console.log('Успешно подписались на push-уведомления');
              }
            })
            .catch(err => {
              console.error('Ошибка при подписке на push-уведомления:', err);
            });
        }
      }
    });
    
    // Инициализируем аудио-контекст для лучшей работы на мобильных устройствах
    initAudioContext().catch(err => console.error('Ошибка инициализации аудио:', err));
    
    // Добавляем обработчик сообщений от сервис-воркера
    navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    
    return () => {
      // Останавливаем звук при размонтировании компонента
      stopSiren();
      
      // Закрываем оверлей, если он открыт
      if (overlayCloseRef.current) {
        overlayCloseRef.current();
      }
      
      // Удаляем обработчик сообщений от сервис-воркера
      navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
    };
  }, []);

  // Обработчик сообщений от сервис-воркера
  const handleServiceWorkerMessage = (event) => {
    const { action, data } = event.data;
    
    if (action === 'accept-sos') {
      // Находим вызов по ID или другим данным
      const callId = data.callId || data.id;
      if (callId) {
        navigate(`/call/${callId}`);
      }
    } else if (action === 'decline-sos') {
      // Находим вызов по ID или другим данным
      const callId = data.callId || data.id;
      if (callId) {
        handleCancelCall(callId);
      }
    }
  };

  // Функция для отправки тестового push-уведомления
  const sendTestPushNotification = async () => {
    try {
      const response = await axios.post('/api/push/test-notification', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setNotification({
        show: true,
        message: `Тестовое уведомление отправлено (${response.data.sentCount})`,
        type: 'success'
      });
      
      // Скрываем уведомление через 3 секунды
      setTimeout(() => {
        setNotification({ show: false, message: '', type: '' });
      }, 3000);
    } catch (error) {
      console.error('Ошибка при отправке тестового уведомления:', error);
      setNotification({
        show: true,
        message: 'Ошибка при отправке тестового уведомления',
        type: 'error'
      });
      
      // Скрываем уведомление через 3 секунды
      setTimeout(() => {
        setNotification({ show: false, message: '', type: '' });
      }, 3000);
    }
  };

  useEffect(() => {
    socketRef.current = io(serverUrl, { 
      auth: { token },
      transports: ['websocket']
    });

    socketRef.current.on('connect', () => {
      socketRef.current.emit('join-room', 'guard');
    });

    socketRef.current.on('incoming-sos', (data) => {
      setActiveCalls(prev => [data, ...prev]);
      
      // Проигрываем сирену при получении нового вызова
      playSiren()
        .then(() => setIsSirenPlaying(true))
        .catch(err => console.error('Ошибка воспроизведения сирены:', err));
      
      // Показываем оверлей с уведомлением
      if (overlayCloseRef.current) {
        overlayCloseRef.current(); // Закрываем предыдущий оверлей, если он есть
      }
      
      overlayCloseRef.current = showIncomingCallOverlay(
        data,
        () => navigate(`/call/${data.id || data._id}`), // При принятии вызова переходим на страницу вызова
        () => handleCancelCall(data.id || data._id) // При отклонении отменяем вызов
      );
    });

    socketRef.current.on('sos-canceled', ({ id }) => {
      setActiveCalls(prev => prev.filter(call => call.id !== id && call._id !== id));
      
      // Если это был последний активный вызов, останавливаем сирену
      if (activeCallsRef.current.length <= 1) {
        stopSiren();
        setIsSirenPlaying(false);
      }
      
      // Закрываем оверлей, если он открыт
      if (overlayCloseRef.current) {
        overlayCloseRef.current();
        overlayCloseRef.current = null;
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [token, serverUrl, navigate]);

  // Функция для остановки сирены
  const stopSirenSound = () => {
    stopSiren();
    setIsSirenPlaying(false);
    
    // Закрываем оверлей, если он открыт
    if (overlayCloseRef.current) {
      overlayCloseRef.current();
      overlayCloseRef.current = null;
    }
  };

  useEffect(() => {
    const fetchActiveCalls = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/calls/active', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setActiveCalls(response.data);
        setError('');
      } catch (err) {
        setError('Не удалось загрузить активные вызовы');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchActiveCalls();
  }, [token]);

  useEffect(() => {
    const fetchCallHistory = async () => {
      if (activeTab === 'history') {
        try {
          setLoading(true);
          setError(''); // Сбрасываем ошибку перед новым запросом
          
          // Добавляем случайный параметр для избежания кэширования
          const timestamp = new Date().getTime();
          const response = await axios.get(`/api/calls/history?_t=${timestamp}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (response.data && Array.isArray(response.data)) {
            setCallHistory(response.data);
            addDebugInfo(`Загружено ${response.data.length} записей истории вызовов`);
          } else {
            setCallHistory([]);
            addDebugInfo('История вызовов пуста или имеет неверный формат');
          }
        } catch (err) {
          console.error('Ошибка загрузки истории вызовов:', err);
          setError('Не удалось загрузить историю вызовов');
          addDebugInfo(`Ошибка загрузки истории: ${err.response?.status || 'неизвестная ошибка'}`);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchCallHistory();
  }, [token, activeTab]);

  // Функция для отладочных сообщений
  const addDebugInfo = (message) => {
    console.log(`[GuardDashboard] ${message}`);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  };

  const handleCancelCall = async (id) => {
    try {
      await axios.post(`/api/calls/cancel/${id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Удаляем вызов из списка активных
      setActiveCalls(prev => prev.filter(call => call.id !== id && call._id !== id));
      
      // Если это был последний активный вызов, останавливаем сирену
      if (activeCallsRef.current.length <= 1) {
        stopSiren();
        setIsSirenPlaying(false);
      }
      
      // Закрываем оверлей, если он открыт
      if (overlayCloseRef.current) {
        overlayCloseRef.current();
        overlayCloseRef.current = null;
      }
      
      // Показываем уведомление об успешной отмене
      setNotification({
        show: true,
        message: 'Вызов отменен',
        type: 'success'
      });
      
      // Скрываем уведомление через 3 секунды
      setTimeout(() => {
        setNotification({ show: false, message: '', type: '' });
      }, 3000);
    } catch (err) {
      console.error('Ошибка при отмене вызова:', err);
      setNotification({
        show: true,
        message: 'Ошибка при отмене вызова',
        type: 'error'
      });
      
      // Скрываем уведомление через 3 секунды
      setTimeout(() => {
        setNotification({ show: false, message: '', type: '' });
      }, 3000);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Функция для обновления истории вызовов
  const refreshHistory = () => {
    if (activeTab === 'history') {
      setActiveTab('active');
      setTimeout(() => {
        setActiveTab('history');
      }, 100);
    }
  };

  // Определяем стили для адаптивной вёрстки
  const styles = {
    container: {
      padding: '16px',
      maxWidth: '1200px',
      margin: '0 auto',
      boxSizing: 'border-box',
      width: '100%'
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      marginBottom: '16px',
      gap: '10px'
    },
    title: {
      fontSize: 'clamp(1.5rem, 4vw, 2rem)',
      margin: '0',
      flex: '1'
    },
    tabs: {
      display: 'flex',
      marginBottom: '16px',
      borderBottom: '1px solid #ddd',
      overflowX: 'auto',
      width: '100%'
    },
    tab: {
      padding: '10px 20px',
      cursor: 'pointer',
      backgroundColor: 'transparent',
      border: 'none',
      borderBottom: '2px solid transparent',
      fontSize: 'clamp(0.875rem, 3vw, 1rem)',
      whiteSpace: 'nowrap'
    },
    activeTab: {
      borderBottom: '2px solid #3182ce',
      fontWeight: 'bold',
      color: '#3182ce'
    },
    callList: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
      gap: '16px',
      marginTop: '16px'
    },
    callCard: {
      border: '1px solid #ddd',
      borderRadius: '8px',
      padding: '16px',
      backgroundColor: '#fff',
      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
      display: 'flex',
      flexDirection: 'column'
    },
    callInfo: {
      marginBottom: '16px'
    },
    callActions: {
      display: 'flex',
      justifyContent: 'space-between',
      marginTop: 'auto'
    },
    button: {
      padding: '8px 16px',
      borderRadius: '4px',
      border: 'none',
      cursor: 'pointer',
      fontSize: 'clamp(0.75rem, 2.5vw, 0.875rem)',
      fontWeight: '600',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px'
    },
    primaryButton: {
      backgroundColor: '#3182ce',
      color: '#fff'
    },
    dangerButton: {
      backgroundColor: '#e53e3e',
      color: '#fff'
    },
    secondaryButton: {
      backgroundColor: '#718096',
      color: '#fff'
    },
    loadingContainer: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '200px'
    },
    errorMessage: {
      color: '#e53e3e',
      padding: '16px',
      textAlign: 'center'
    },
    notification: {
      position: 'fixed',
      top: '20px',
      right: '20px',
      padding: '12px 16px',
      borderRadius: '4px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      zIndex: 1000,
      maxWidth: '300px',
      animation: 'fadeIn 0.3s ease'
    },
    successNotification: {
      backgroundColor: '#48bb78',
      color: '#fff'
    },
    errorNotification: {
      backgroundColor: '#e53e3e',
      color: '#fff'
    },
    emptyState: {
      textAlign: 'center',
      padding: '40px 20px',
      color: '#718096'
    },
    sirenControl: {
      display: 'flex',
      alignItems: 'center',
      marginLeft: '16px'
    },
    // Медиа-запросы для мобильных устройств
    '@media (max-width: 768px)': {
      header: {
        flexDirection: 'column',
        alignItems: 'flex-start'
      },
      callList: {
        gridTemplateColumns: '1fr'
      },
      callCard: {
        padding: '12px'
      },
      callActions: {
        flexDirection: 'column',
        gap: '8px'
      },
      button: {
        width: '100%'
      }
    }
  };

  return (
    <div style={styles.container}>
      {/* Уведомление */}
      {notification.show && (
        <div 
          style={{
            ...styles.notification,
            ...(notification.type === 'success' ? styles.successNotification : styles.errorNotification)
          }}
        >
          {notification.message}
        </div>
      )}

      <div style={styles.header}>
        <h1 style={styles.title}>Панель охраны</h1>
        
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {/* Кнопка для тестирования push-уведомлений */}
          {pushSupported && (
            <button 
              style={{ ...styles.button, ...styles.secondaryButton }}
              onClick={sendTestPushNotification}
            >
              Тест Push
            </button>
          )}
          
          {/* Кнопка для остановки сирены */}
          {isSirenPlaying && (
            <button 
              style={{ ...styles.button, ...styles.dangerButton }}
              onClick={stopSirenSound}
            >
              <span role="img" aria-label="Остановить сирену">🔇</span> Стоп
            </button>
          )}
          
          {/* Кнопка выхода */}
          <button 
            style={{ ...styles.button, ...styles.secondaryButton }}
            onClick={handleLogout}
          >
            Выйти
          </button>
        </div>
      </div>

      <div style={styles.tabs}>
        <button 
          style={{ 
            ...styles.tab, 
            ...(activeTab === 'active' ? styles.activeTab : {}) 
          }}
          onClick={() => setActiveTab('active')}
        >
          Активные вызовы {activeCalls.length > 0 && `(${activeCalls.length})`}
        </button>
        <button 
          style={{ 
            ...styles.tab, 
            ...(activeTab === 'history' ? styles.activeTab : {}) 
          }}
          onClick={() => setActiveTab('history')}
        >
          История вызовов
        </button>
      </div>

      {/* Содержимое вкладки */}
      {activeTab === 'active' ? (
        <>
          {loading ? (
            <div style={styles.loadingContainer}>
              <p>Загрузка...</p>
            </div>
          ) : error ? (
            <div style={styles.errorMessage}>
              <p>{error}</p>
              <button 
                style={{ ...styles.button, ...styles.primaryButton }}
                onClick={() => window.location.reload()}
              >
                Обновить
              </button>
            </div>
          ) : activeCalls.length > 0 ? (
            <div style={styles.callList}>
              {activeCalls.map((call) => (
                <div key={call.id || call._id} style={styles.callCard}>
                  <div style={styles.callInfo}>
                    <h3>{call.userName || 'Пользователь'}</h3>
                    <p>Телефон: {call.phone}</p>
                    <p>Время: {formatDate(call.createdAt)}</p>
                  </div>
                  <div style={styles.callActions}>
                    <Link to={`/call/${call.id || call._id}`}>
                      <button style={{ ...styles.button, ...styles.primaryButton }}>
                        <span role="img" aria-label="Ответить">📞</span> Ответить
                      </button>
                    </Link>
                    <button 
                      style={{ ...styles.button, ...styles.dangerButton }}
                      onClick={() => handleCancelCall(call.id || call._id)}
                    >
                      <span role="img" aria-label="Отклонить">❌</span> Отклонить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={styles.emptyState}>
              <p>Нет активных вызовов</p>
            </div>
          )}
        </>
      ) : (
        <>
          {loading ? (
            <div style={styles.loadingContainer}>
              <p>Загрузка истории...</p>
            </div>
          ) : error ? (
            <div style={styles.errorMessage}>
              <p>{error}</p>
              <button 
                style={{ ...styles.button, ...styles.primaryButton }}
                onClick={refreshHistory}
              >
                Обновить
              </button>
            </div>
          ) : callHistory.length > 0 ? (
            <div style={styles.callList}>
              {callHistory.map((call) => (
                <div key={call.id || call._id} style={styles.callCard}>
                  <div style={styles.callInfo}>
                    <h3>{call.userName || 'Пользователь'}</h3>
                    <p>Телефон: {call.phone}</p>
                    <p>Время: {formatDate(call.createdAt)}</p>
                    <p>Статус: {call.status === 'completed' ? 'Завершен' : 'Отменен'}</p>
                  </div>
                  <div style={styles.callActions}>
                    <Link to={`/call-details/${call.id || call._id}`}>
                      <button style={{ ...styles.button, ...styles.secondaryButton }}>
                        <span role="img" aria-label="Детали">📋</span> Детали
                      </button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={styles.emptyState}>
              <p>История вызовов пуста</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default GuardDashboard;
