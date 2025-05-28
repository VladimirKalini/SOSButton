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
          const response = await axios.get('/api/calls/history', {
            headers: { Authorization: `Bearer ${token}` }
          });
          setCallHistory(response.data);
          setError('');
        } catch (err) {
          setError('Не удалось загрузить историю вызовов');
          console.error('Ошибка загрузки истории вызовов:', err);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchCallHistory();
  }, [token, activeTab]);

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
    <div style={{ 
      padding: '1.5rem',
      maxWidth: '1200px',
      margin: '0 auto',
      backgroundColor: '#f8f9fa',
      minHeight: '100vh'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '2rem',
        padding: '1rem',
        backgroundColor: 'white',
        borderRadius: '0.75rem',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
      }}>
        <h2 style={{ 
          margin: 0, 
          color: '#343a40',
          fontSize: '1.75rem'
        }}>Панель охраны</h2>
        <button 
          onClick={handleLogout} 
          style={{ 
            padding: '0.75rem 1.5rem', 
            backgroundColor: '#dc3545', 
            color: 'white', 
            border: 'none',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            fontWeight: 'bold',
            boxShadow: '0 2px 4px rgba(220, 53, 69, 0.2)',
            transition: 'all 0.2s ease'
          }}
        >
          Выйти
        </button>
      </div>

      {/* Уведомление */}
      {notification.show && (
        <div style={{ 
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          borderRadius: '0.5rem',
          backgroundColor: notification.type === 'success' ? '#d4edda' : '#f8d7da',
          color: notification.type === 'success' ? '#155724' : '#721c24',
          border: `1px solid ${notification.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`,
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)',
          display: 'flex',
          alignItems: 'center'
        }}>
          {notification.type === 'success' ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16" style={{ marginRight: '0.75rem' }}>
              <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16" style={{ marginRight: '0.75rem' }}>
              <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
              <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/>
            </svg>
          )}
          {notification.message}
        </div>
      )}

      {error && (
        <div style={{ 
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          borderRadius: '0.5rem',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          border: '1px solid #f5c6cb',
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)',
          display: 'flex',
          alignItems: 'center'
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16" style={{ marginRight: '0.75rem' }}>
            <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
            <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/>
          </svg>
          {error}
        </div>
      )}

      <div style={{ 
        marginBottom: '1.5rem',
        display: 'flex',
        backgroundColor: 'white',
        borderRadius: '0.75rem',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
      }}>
        <button 
          onClick={() => setActiveTab('active')} 
          style={{ 
            padding: '1rem 1.5rem', 
            backgroundColor: activeTab === 'active' ? '#007bff' : 'white',
            color: activeTab === 'active' ? 'white' : '#495057',
            border: 'none',
            cursor: 'pointer',
            flex: 1,
            fontWeight: activeTab === 'active' ? 'bold' : 'normal',
            transition: 'all 0.2s ease'
          }}
        >
          Активные вызовы
        </button>
        <button 
          onClick={() => setActiveTab('history')} 
          style={{ 
            padding: '1rem 1.5rem', 
            backgroundColor: activeTab === 'history' ? '#007bff' : 'white',
            color: activeTab === 'history' ? 'white' : '#495057',
            border: 'none',
            cursor: 'pointer',
            flex: 1,
            fontWeight: activeTab === 'history' ? 'bold' : 'normal',
            transition: 'all 0.2s ease'
          }}
        >
          История вызовов
        </button>
      </div>

      {loading ? (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '3rem',
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
        }}>
          <div className="spinner" style={{
            width: '50px',
            height: '50px',
            border: '5px solid rgba(0, 123, 255, 0.2)',
            borderRadius: '50%',
            borderTop: '5px solid #007bff',
            animation: 'spin 1s linear infinite'
          }}></div>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      ) : activeTab === 'active' ? (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
        }}>
          <h2 style={{ 
            marginTop: 0, 
            color: '#343a40',
            fontSize: '1.5rem',
            marginBottom: '1.5rem'
          }}>Активные SOS вызовы</h2>
          {activeCalls.length === 0 ? (
            <div style={{
              padding: '3rem',
              textAlign: 'center',
              color: '#6c757d',
              backgroundColor: '#f8f9fa',
              borderRadius: '0.5rem',
              border: '1px dashed #dee2e6'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" viewBox="0 0 16 16" style={{ marginBottom: '1rem', opacity: 0.5 }}>
                <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/>
              </svg>
              <p style={{ fontSize: '1.1rem', fontWeight: '500' }}>Нет активных вызовов</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '1.5rem' }}>
              {activeCalls.map(call => (
                <div 
                  key={call.id || call._id} 
                  style={{ 
                    border: '1px solid #e9ecef', 
                    borderRadius: '0.75rem',
                    padding: '1.5rem',
                    backgroundColor: '#f8f9fa',
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    ':hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                    }
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      padding: '0.5rem 1rem',
                      borderRadius: '2rem',
                      fontWeight: 'bold'
                    }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style={{ marginRight: '0.5rem' }}>
                        <path d="M11 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h6zM5 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H5z"/>
                        <path d="M8 14a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/>
                      </svg>
                      {call.phone}
                    </div>
                    <div style={{
                      backgroundColor: '#e9ecef',
                      padding: '0.5rem 1rem',
                      borderRadius: '2rem',
                      fontSize: '0.9rem',
                      color: '#495057',
                      fontWeight: '500'
                    }}>
                      {call.createdAt && formatDate(call.createdAt)}
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                    <Link 
                      to={`/call/${call.id || call._id}`} 
                      style={{ 
                        padding: '0.75rem 1.5rem', 
                        backgroundColor: '#28a745', 
                        color: 'white', 
                        borderRadius: '0.5rem',
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        fontWeight: 'bold',
                        boxShadow: '0 2px 4px rgba(40, 167, 69, 0.2)',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style={{ marginRight: '0.5rem' }}>
                        <path d="M0 5a2 2 0 0 1 2-2h7.5a2 2 0 0 1 1.983 1.738l3.11-1.382A1 1 0 0 1 16 4.269v7.462a1 1 0 0 1-1.406.913l-3.111-1.382A2 2 0 0 1 9.5 13H2a2 2 0 0 1-2-2V5z"/>
                      </svg>
                      Просмотреть
                    </Link>
                    <button 
                      onClick={() => handleCancelCall(call.id || call._id)} 
                      style={{ 
                        padding: '0.75rem 1.5rem', 
                        backgroundColor: '#dc3545', 
                        color: 'white', 
                        border: 'none',
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        display: 'inline-flex',
                        alignItems: 'center',
                        boxShadow: '0 2px 4px rgba(220, 53, 69, 0.2)',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style={{ marginRight: '0.5rem' }}>
                        <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                        <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                      </svg>
                      Отменить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
        }}>
          <h2 style={{ 
            marginTop: 0, 
            color: '#343a40',
            fontSize: '1.5rem',
            marginBottom: '1.5rem'
          }}>История вызовов</h2>
          {callHistory.length === 0 ? (
            <div style={{
              padding: '3rem',
              textAlign: 'center',
              color: '#6c757d',
              backgroundColor: '#f8f9fa',
              borderRadius: '0.5rem',
              border: '1px dashed #dee2e6'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" viewBox="0 0 16 16" style={{ marginBottom: '1rem', opacity: 0.5 }}>
                <path d="M14.5 3a.5.5 0 0 1 .5.5v9a.5.5 0 0 1-.5.5h-13a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h13zm-13-1A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h13a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 14.5 2h-13z"/>
                <path d="M3 5.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zM3 8a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9A.5.5 0 0 1 3 8zm0 2.5a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 0 1h-6a.5.5 0 0 1-.5-.5z"/>
              </svg>
              <p style={{ fontSize: '1.1rem', fontWeight: '500' }}>История вызовов пуста</p>
            </div>
          ) : (
            <div>
              <div style={{ display: 'grid', gap: '1.5rem' }}>
                {callHistory.map(call => (
                  <div 
                    key={call._id} 
                    style={{ 
                      border: '1px solid #e9ecef', 
                      borderRadius: '0.75rem',
                      padding: '1.5rem',
                      backgroundColor: '#f8f9fa',
                      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)',
                      opacity: call.status === 'active' ? 1 : 0.7
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center',
                        backgroundColor: '#6c757d',
                        color: 'white',
                        padding: '0.5rem 1rem',
                        borderRadius: '2rem',
                        fontWeight: 'bold'
                      }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style={{ marginRight: '0.5rem' }}>
                          <path d="M11 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h6zM5 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H5z"/>
                          <path d="M8 14a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/>
                        </svg>
                        {call.phone}
                      </div>
                      <div style={{
                        backgroundColor: call.status === 'active' ? '#28a745' : '#dc3545',
                        color: 'white',
                        padding: '0.5rem 1rem',
                        borderRadius: '2rem',
                        fontSize: '0.9rem',
                        fontWeight: '500'
                      }}>
                        {call.status === 'active' ? 'Активный' : 'Отменен'}
                      </div>
                    </div>
                    <div style={{
                      backgroundColor: '#e9ecef',
                      padding: '0.5rem 1rem',
                      borderRadius: '0.5rem',
                      fontSize: '0.9rem',
                      color: '#495057',
                      display: 'inline-block',
                      marginBottom: '1rem'
                    }}>
                      <strong>Время:</strong> {formatDate(call.createdAt)}
                    </div>
                    
                    {call.status === 'active' && (
                      <div style={{ marginTop: '1rem' }}>
                        <Link 
                          to={`/call/${call._id}`} 
                          style={{ 
                            padding: '0.75rem 1.5rem', 
                            backgroundColor: '#28a745', 
                            color: 'white', 
                            borderRadius: '0.5rem',
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            fontWeight: 'bold',
                            boxShadow: '0 2px 4px rgba(40, 167, 69, 0.2)',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style={{ marginRight: '0.5rem' }}>
                            <path d="M0 5a2 2 0 0 1 2-2h7.5a2 2 0 0 1 1.983 1.738l3.11-1.382A1 1 0 0 1 16 4.269v7.462a1 1 0 0 1-1.406.913l-3.111-1.382A2 2 0 0 1 9.5 13H2a2 2 0 0 1-2-2V5z"/>
                          </svg>
                          Просмотреть
                        </Link>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
                <button 
                  onClick={() => setPage(p => Math.max(1, p - 1))} 
                  disabled={page === 1}
                  style={{ 
                    padding: '0.75rem 1.5rem', 
                    backgroundColor: page === 1 ? '#e9ecef' : '#007bff',
                    color: page === 1 ? '#6c757d' : 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: page === 1 ? 'not-allowed' : 'pointer',
                    fontWeight: 'bold',
                    display: 'inline-flex',
                    alignItems: 'center',
                    boxShadow: page === 1 ? 'none' : '0 2px 4px rgba(0, 123, 255, 0.2)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style={{ marginRight: '0.5rem' }}>
                    <path fillRule="evenodd" d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/>
                  </svg>
                  Назад
                </button>
                <span style={{ 
                  padding: '0.75rem 1.5rem',
                  backgroundColor: 'white',
                  borderRadius: '0.5rem',
                  fontWeight: 'bold',
                  color: '#495057',
                  border: '1px solid #dee2e6'
                }}>Страница {page}</span>
                <button 
                  onClick={() => setPage(p => p + 1)} 
                  disabled={callHistory.length < 10}
                  style={{ 
                    padding: '0.75rem 1.5rem', 
                    backgroundColor: callHistory.length < 10 ? '#e9ecef' : '#007bff',
                    color: callHistory.length < 10 ? '#6c757d' : 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: callHistory.length < 10 ? 'not-allowed' : 'pointer',
                    fontWeight: 'bold',
                    display: 'inline-flex',
                    alignItems: 'center',
                    boxShadow: callHistory.length < 10 ? 'none' : '0 2px 4px rgba(0, 123, 255, 0.2)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Вперед
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style={{ marginLeft: '0.5rem' }}>
                    <path fillRule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
                  </svg>
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
