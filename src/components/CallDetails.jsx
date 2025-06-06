import React, { useState, useEffect, useRef } from 'react';
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
  const serverUrl = 'https://novyy-gorizont-sos.com';

  // Функция для добавления отладочной информации
  const addDebugInfo = (message) => {
    setDebugInfo(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
    console.log(`[CallDetails] ${message}`);
  };

  useEffect(() => {
    // Загружаем данные о вызове
    const fetchCallData = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`/api/calls/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        setCallData(response.data);
        addDebugInfo(`Данные вызова загружены: ${response.data.phone}`);
      } catch (err) {
        console.error('Ошибка при загрузке данных вызова:', err);
        setError('Не удалось загрузить данные вызова');
        addDebugInfo(`Ошибка загрузки данных: ${err.message}`);
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
      addDebugInfo(`Ошибка подключения Socket.IO: ${err.message}`);
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
      
      await axios.delete(`/api/calls/${id}/cancel`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      addDebugInfo('Вызов успешно завершен');
      navigate('/');
    } catch (err) {
      console.error('Ошибка при завершении вызова:', err);
      addDebugInfo(`Ошибка завершения вызова: ${err.message}`);
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
          `@keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }`
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
                  href={`https://www.google.com/maps?q=${callData.latitude},${callData.longitude}`}
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
        <p>Используйте телефонную связь для коммуникации с пользователем.</p>
        
        {callData && callData.phone && (
          <a
            href={`tel:${callData.phone}`}
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

export default CallDetails;