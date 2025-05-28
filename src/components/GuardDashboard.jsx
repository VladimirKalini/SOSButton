// src/components/guard/GuardDashboard.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../authContext';
import { io } from 'socket.io-client';

const GuardDashboard = () => {
  const [activeCalls, setActiveCalls] = useState([]);
  const [callHistory, setCallHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('active');
  const [page, setPage] = useState(1);
  const { token } = useAuth();
  const serverUrl = 'https://1fxpro.vip';
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });

  useEffect(() => {
    const socket = io(serverUrl, { 
      auth: { token },
      transports: ['websocket']
    });

    socket.on('connect', () => {
      socket.emit('join-room', 'guard');
    });

    socket.on('incoming-sos', (data) => {
      setActiveCalls(prev => [data, ...prev]);
    });

    socket.on('sos-canceled', ({ id }) => {
      setActiveCalls(prev => prev.filter(call => call.id !== id));
    });

    return () => socket.disconnect();
  }, [token, serverUrl]);

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
          const response = await axios.get(`/api/calls/history?page=${page}&limit=10`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setCallHistory(response.data);
          setError('');
        } catch (err) {
          setError('Не удалось загрузить историю вызовов');
          console.error(err);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchCallHistory();
  }, [token, page, activeTab]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  };

  const handleCancelCall = async (id) => {
    try {
      await axios.delete(`/api/calls/${id}/cancel`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Обновляем список активных вызовов
      setActiveCalls(prev => prev.filter(call => call.id !== id && call._id !== id));
      
      // Показываем уведомление об успешной отмене
      setNotification({
        show: true,
        message: 'Вызов успешно отменен',
        type: 'success'
      });
      
      // Скрываем уведомление через 3 секунды
      setTimeout(() => {
        setNotification({ show: false, message: '', type: '' });
      }, 3000);
    } catch (err) {
      console.error('Ошибка при отмене вызова:', err);
      
      setError('Не удалось отменить вызов');
      
      // Показываем уведомление об ошибке
      setNotification({
        show: true,
        message: 'Не удалось отменить вызов: ' + (err.response?.data?.message || err.message),
        type: 'error'
      });
      
      // Скрываем уведомление через 3 секунды
      setTimeout(() => {
        setNotification({ show: false, message: '', type: '' });
      }, 3000);
    }
  };

  const handleLogout = () => {
    // Implement the logout logic here
  };

  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>Панель охраны</h2>
        <button 
          onClick={handleLogout} 
          style={{ 
            padding: '0.5rem 1rem', 
            backgroundColor: '#dc3545', 
            color: 'white', 
            border: 'none',
            borderRadius: '0.25rem',
            cursor: 'pointer'
          }}
        >
          Выйти
        </button>
      </div>

      {/* Уведомление */}
      {notification.show && (
        <div style={{ 
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
          borderRadius: '0.25rem',
          backgroundColor: notification.type === 'success' ? '#d4edda' : '#f8d7da',
          color: notification.type === 'success' ? '#155724' : '#721c24',
          border: `1px solid ${notification.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`
        }}>
          {notification.message}
        </div>
      )}

      {error && (
        <div style={{ 
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
          borderRadius: '0.25rem',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          border: '1px solid #f5c6cb'
        }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: '1rem' }}>
        <button 
          onClick={() => setActiveTab('active')} 
          style={{ 
            padding: '0.5rem 1rem', 
            backgroundColor: activeTab === 'active' ? '#007bff' : '#f8f9fa',
            color: activeTab === 'active' ? 'white' : '#212529',
            border: '1px solid #dee2e6',
            borderRadius: '0.25rem 0 0 0.25rem',
            cursor: 'pointer'
          }}
        >
          Активные вызовы
        </button>
        <button 
          onClick={() => setActiveTab('history')} 
          style={{ 
            padding: '0.5rem 1rem', 
            backgroundColor: activeTab === 'history' ? '#007bff' : '#f8f9fa',
            color: activeTab === 'history' ? 'white' : '#212529',
            border: '1px solid #dee2e6',
            borderLeft: 'none',
            borderRadius: '0 0.25rem 0.25rem 0',
            cursor: 'pointer'
          }}
        >
          История вызовов
        </button>
      </div>

      {loading ? (
        <div>Загрузка...</div>
      ) : activeTab === 'active' ? (
        <div>
          <h2>Активные SOS вызовы</h2>
          {activeCalls.length === 0 ? (
            <p>Нет активных вызовов</p>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {activeCalls.map(call => (
                <div 
                  key={call.id || call._id} 
                  style={{ 
                    border: '1px solid #dee2e6', 
                    borderRadius: '0.25rem',
                    padding: '1rem',
                    backgroundColor: '#f8f9fa'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div>
                      <strong>Телефон:</strong> {call.phone}
                    </div>
                    <div>
                      {call.createdAt && (
                        <span><strong>Время:</strong> {formatDate(call.createdAt)}</span>
                      )}
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                    <Link 
                      to={`/call/${call.id || call._id}`} 
                      style={{ 
                        padding: '0.5rem 1rem', 
                        backgroundColor: '#28a745', 
                        color: 'white', 
                        borderRadius: '0.25rem',
                        textDecoration: 'none',
                        display: 'inline-block'
                      }}
                    >
                      Просмотреть
                    </Link>
                    <button 
                      onClick={() => handleCancelCall(call.id || call._id)} 
                      style={{ 
                        padding: '0.5rem 1rem', 
                        backgroundColor: '#dc3545', 
                        color: 'white', 
                        border: 'none',
                        borderRadius: '0.25rem',
                        cursor: 'pointer'
                      }}
                    >
                      Отменить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          <h2>История вызовов</h2>
          {callHistory.length === 0 ? (
            <p>История вызовов пуста</p>
          ) : (
            <div>
              <div style={{ display: 'grid', gap: '1rem' }}>
                {callHistory.map(call => (
                  <div 
                    key={call._id} 
                    style={{ 
                      border: '1px solid #dee2e6', 
                      borderRadius: '0.25rem',
                      padding: '1rem',
                      backgroundColor: '#f8f9fa'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <div>
                        <strong>Телефон:</strong> {call.phone}
                      </div>
                      <div>
                        <span><strong>Статус:</strong> {call.status === 'active' ? 'Активный' : 'Отменен'}</span>
                      </div>
                    </div>
                    <div>
                      <strong>Время:</strong> {formatDate(call.createdAt)}
                    </div>
                    
                    {call.status === 'active' && (
                      <div style={{ marginTop: '1rem' }}>
                        <Link 
                          to={`/call/${call._id}`} 
                          style={{ 
                            padding: '0.5rem 1rem', 
                            backgroundColor: '#28a745', 
                            color: 'white', 
                            borderRadius: '0.25rem',
                            textDecoration: 'none',
                            display: 'inline-block'
                          }}
                        >
                          Просмотреть
                        </Link>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                <button 
                  onClick={() => setPage(p => Math.max(1, p - 1))} 
                  disabled={page === 1}
                  style={{ 
                    padding: '0.5rem 1rem', 
                    backgroundColor: page === 1 ? '#f8f9fa' : '#007bff',
                    color: page === 1 ? '#6c757d' : 'white',
                    border: '1px solid #dee2e6',
                    borderRadius: '0.25rem',
                    cursor: page === 1 ? 'not-allowed' : 'pointer'
                  }}
                >
                  Назад
                </button>
                <span style={{ padding: '0.5rem 1rem' }}>Страница {page}</span>
                <button 
                  onClick={() => setPage(p => p + 1)} 
                  disabled={callHistory.length < 10}
                  style={{ 
                    padding: '0.5rem 1rem', 
                    backgroundColor: callHistory.length < 10 ? '#f8f9fa' : '#007bff',
                    color: callHistory.length < 10 ? '#6c757d' : 'white',
                    border: '1px solid #dee2e6',
                    borderRadius: '0.25rem',
                    cursor: callHistory.length < 10 ? 'not-allowed' : 'pointer'
                  }}
                >
                  Вперед
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GuardDashboard;
