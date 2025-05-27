import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../authContext';
import { io } from 'socket.io-client';

const CallDetails = () => {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [call, setCall] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const peerRef = useRef(null);
  const videoRef = useRef(null);
  const socketRef = useRef(null);
  const serverUrl = 'https://1fxpro.vip';
  const mapRef = useRef(null);
  const mapMarkerRef = useRef(null);
  const [recordedVideos, setRecordedVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [viewMode, setViewMode] = useState('live'); // 'live' или 'recorded'
  const [connectionStatus, setConnectionStatus] = useState('Подключение...');
  const [hasVideo, setHasVideo] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');

  // Добавляем отладочную информацию
  const addDebugInfo = (info) => {
    console.log(info);
    setDebugInfo(prev => `${prev}\n${info}`);
  };

  useEffect(() => {
    const fetchCallDetails = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`/api/calls/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setCall(response.data);
        setError('');
        
        // Загружаем записанные видео
        if (response.data.recordingStarted) {
          fetchRecordedVideos();
        }
      } catch (err) {
        setError('Не удалось загрузить данные вызова');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchCallDetails();
  }, [id, token]);
  
  // Получение списка записанных видео
  const fetchRecordedVideos = async () => {
    try {
      const response = await axios.get(`/api/calls/${id}/video`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRecordedVideos(response.data);
      
      // Автоматически выбираем первое видео, если есть
      if (response.data.length > 0) {
        setSelectedVideo(response.data[0]);
      }
    } catch (err) {
      console.error('Не удалось загрузить записанные видео:', err);
    }
  };

  useEffect(() => {
    if (!call) return;

    // Если выбран режим записанных видео, не инициализируем WebRTC
    if (viewMode === 'recorded') return;

    addDebugInfo('Инициализация WebRTC соединения...');
    setConnectionStatus('Инициализация соединения...');
    setHasVideo(false);
    setHasAudio(false);

    // Инициализация WebRTC
    peerRef.current = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
      ]
    });

    peerRef.current.ontrack = (event) => {
      addDebugInfo(`Получен медиа-трек: ${event.track.kind}`);
      
      if (event.track.kind === 'video') {
        setHasVideo(true);
      } else if (event.track.kind === 'audio') {
        setHasAudio(true);
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = event.streams[0];
        videoRef.current.play().catch(err => {
          addDebugInfo(`Ошибка воспроизведения: ${err.message}`);
        });
        addDebugInfo('Видеопоток установлен в элемент video');
      } else {
        addDebugInfo('Ошибка: videoRef.current отсутствует');
      }
    };

    peerRef.current.oniceconnectionstatechange = () => {
      const state = peerRef.current.iceConnectionState;
      addDebugInfo(`ICE состояние изменилось: ${state}`);
      setConnectionStatus(`ICE состояние: ${state}`);
      
      if (state === 'connected' || state === 'completed') {
        setConnectionStatus('Соединение установлено');
      } else if (state === 'failed' || state === 'disconnected') {
        setError('Соединение потеряно. Пытаемся восстановить...');
        // Пробуем переподключиться
        setTimeout(() => {
          if (peerRef.current) {
            peerRef.current.restartIce();
            addDebugInfo('Попытка восстановления ICE соединения');
          }
        }, 1000);
      }
    };

    peerRef.current.onsignalingstatechange = () => {
      addDebugInfo(`Signaling состояние: ${peerRef.current.signalingState}`);
    };

    // Подключение к Socket.IO
    socketRef.current = io(serverUrl, {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    socketRef.current.on('connect', () => {
      addDebugInfo(`Socket.IO подключен, присоединяемся к комнате: ${id}`);
      socketRef.current.emit('join-room', id);
    });

    socketRef.current.on('connect_error', (err) => {
      addDebugInfo(`Ошибка подключения Socket.IO: ${err.message}`);
      setError('Не удалось подключиться к серверу');
    });

    socketRef.current.on('ice-candidate', async (candidate) => {
      try {
        addDebugInfo('Получен ICE кандидат от клиента');
        if (peerRef.current && peerRef.current.remoteDescription) {
          await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
          addDebugInfo('ICE кандидат успешно добавлен');
        } else {
          addDebugInfo('Не удалось добавить ICE кандидата: нет remoteDescription');
        }
      } catch (err) {
        addDebugInfo(`Ошибка при добавлении ICE кандидата: ${err.message}`);
      }
    });

    socketRef.current.on('sos-canceled', () => {
      setError('SOS вызов был отменен');
      setTimeout(() => navigate('/'), 3000);
    });

    // Создание ответа на offer
    const handleOffer = async () => {
      try {
        addDebugInfo('Обработка offer от клиента');
        
        if (!call.offer) {
          addDebugInfo('Offer отсутствует в данных вызова');
          setError('Не удалось установить видеосвязь: отсутствует offer');
          return;
        }
        
        await peerRef.current.setRemoteDescription(new RTCSessionDescription(call.offer));
        addDebugInfo('Remote description установлен');
        
        peerRef.current.onicecandidate = ({ candidate }) => {
          if (candidate) {
            addDebugInfo('Отправка ICE кандидата клиенту');
            socketRef.current.emit('ice-candidate', { candidate, id });
          }
        };

        const answer = await peerRef.current.createAnswer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });
        await peerRef.current.setLocalDescription(answer);
        addDebugInfo('Local description (answer) установлен');
        
        socketRef.current.emit('sos-answer', { answer, id });
        addDebugInfo('Answer отправлен клиенту');
        
        setConnectionStatus('Ожидание соединения...');
        
        // Устанавливаем таймаут для проверки соединения
        setTimeout(() => {
          if (!hasVideo && !hasAudio && peerRef.current) {
            addDebugInfo('Таймаут: нет медиа-треков. Пробуем переподключиться...');
            handleOffer(); // Пробуем переподключиться
          }
        }, 10000);
      } catch (err) {
        addDebugInfo(`Ошибка при установке WebRTC соединения: ${err.message}`);
        setError('Не удалось установить видеосвязь: ' + err.message);
      }
    };

    if (call.offer) {
      handleOffer();
    } else {
      addDebugInfo('Отсутствует offer для установки соединения');
      setError('Отсутствует offer для установки соединения');
    }

    return () => {
      if (peerRef.current) {
        peerRef.current.close();
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [call, id, token, navigate, serverUrl, viewMode]);

  useEffect(() => {
    if (!call || !call.latitude || !call.longitude) return;

    // Используем Google Maps API с вашим ключом
    const googleMapsApiKey = 'AIzaSyD7IrOL7Ck6UVlhAZXXcmVRzAzNQ0kkEbA'; // Замените на ваш ключ
    
    if (!window.google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&callback=initMap`;
      script.async = true;
      script.defer = true;
      
      window.initMap = () => {
        initializeMap(call.latitude, call.longitude);
      };
      
      document.head.appendChild(script);
    } else {
      initializeMap(call.latitude, call.longitude);
    }
  }, [call]);

  const initializeMap = (lat, lng) => {
    if (!mapRef.current) return;

    try {
      const latNum = parseFloat(lat);
      const lngNum = parseFloat(lng);
      
      if (isNaN(latNum) || isNaN(lngNum)) {
        console.error('Некорректные координаты:', lat, lng);
        return;
      }
      
      const map = new window.google.maps.Map(mapRef.current, {
        center: { lat: latNum, lng: lngNum },
        zoom: 15,
      });

      const marker = new window.google.maps.Marker({
        position: { lat: latNum, lng: lngNum },
        map,
        title: 'SOS местоположение'
      });

      mapMarkerRef.current = marker;
    } catch (error) {
      console.error('Ошибка при инициализации карты:', error);
    }
  };

  const handleCancelCall = async () => {
    try {
      await axios.delete(`/api/calls/${id}/cancel`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      navigate('/');
    } catch (err) {
      setError('Не удалось отменить вызов');
      console.error(err);
    }
  };
  
  // Переключение между режимами просмотра
  const toggleViewMode = () => {
    setViewMode(viewMode === 'live' ? 'recorded' : 'live');
    
    // Если переключаемся на записанные видео, загружаем их
    if (viewMode === 'live' && call?.recordingStarted) {
      fetchRecordedVideos();
    }
  };
  
  // Выбор видео для просмотра
  const handleSelectVideo = (video) => {
    setSelectedVideo(video);
  };

  if (loading) {
    return <div>Загрузка данных вызова...</div>;
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <div style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>
        <button 
          onClick={() => navigate('/')} 
          style={{ 
            padding: '0.5rem 1rem', 
            backgroundColor: '#007bff', 
            color: 'white', 
            border: 'none',
            borderRadius: '0.25rem',
            cursor: 'pointer'
          }}
        >
          Вернуться на главную
        </button>
      </div>
    );
  }

  if (!call) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <div>Вызов не найден</div>
        <button 
          onClick={() => navigate('/')} 
          style={{ 
            padding: '0.5rem 1rem', 
            backgroundColor: '#007bff', 
            color: 'white', 
            border: 'none',
            borderRadius: '0.25rem',
            cursor: 'pointer',
            marginTop: '1rem'
          }}
        >
          Вернуться на главную
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>Детали SOS вызова</h2>
        <button 
          onClick={() => navigate('/')} 
          style={{ 
            padding: '0.5rem 1rem', 
            backgroundColor: '#6c757d', 
            color: 'white', 
            border: 'none',
            borderRadius: '0.25rem',
            cursor: 'pointer'
          }}
        >
          Назад
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div>
          <div style={{ 
            border: '1px solid #dee2e6', 
            borderRadius: '0.25rem',
            padding: '1rem',
            marginBottom: '1rem',
            backgroundColor: '#f8f9fa'
          }}>
            <h3>Информация о вызове</h3>
            <p><strong>Телефон:</strong> {call.phone}</p>
            <p><strong>Статус:</strong> {call.status === 'active' ? 'Активный' : 'Отменен'}</p>
            {call.createdAt && (
              <p><strong>Время создания:</strong> {new Date(call.createdAt).toLocaleString()}</p>
            )}
            <button 
              onClick={handleCancelCall} 
              disabled={call.status !== 'active'}
              style={{ 
                padding: '0.5rem 1rem', 
                backgroundColor: call.status !== 'active' ? '#f8f9fa' : '#dc3545',
                color: call.status !== 'active' ? '#6c757d' : 'white',
                border: '1px solid #dee2e6',
                borderRadius: '0.25rem',
                cursor: call.status !== 'active' ? 'not-allowed' : 'pointer',
                marginTop: '1rem'
              }}
            >
              Отменить вызов
            </button>
          </div>

          <div style={{ 
            border: '1px solid #dee2e6', 
            borderRadius: '0.25rem',
            padding: '1rem',
            backgroundColor: '#f8f9fa',
            height: '300px'
          }}>
            <h3>Местоположение</h3>
            <div 
              ref={mapRef} 
              style={{ 
                height: '250px', 
                borderRadius: '0.25rem',
                backgroundColor: '#e9ecef'
              }}
            >
              {(!call.latitude || !call.longitude) ? (
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center', 
                  height: '100%',
                  color: '#6c757d'
                }}>
                  Геолокация недоступна
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div style={{ 
          border: '1px solid #dee2e6', 
          borderRadius: '0.25rem',
          padding: '1rem',
          backgroundColor: '#f8f9fa'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3>Видеотрансляция</h3>
            
            {call.recordingStarted && (
              <button 
                onClick={toggleViewMode}
                style={{ 
                  padding: '0.5rem 1rem', 
                  backgroundColor: '#007bff', 
                  color: 'white', 
                  border: 'none',
                  borderRadius: '0.25rem',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                {viewMode === 'live' ? 'Архивные записи' : 'Прямая трансляция'}
              </button>
            )}
          </div>
          
          {viewMode === 'live' ? (
            <div>
              <div style={{ 
                backgroundColor: '#000', 
                borderRadius: '0.25rem',
                height: '400px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'hidden',
                position: 'relative'
              }}>
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline
                  controls
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
                
                {(!hasVideo && !hasAudio) && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    flexDirection: 'column',
                    padding: '1rem'
                  }}>
                    <div style={{ marginBottom: '1rem' }}>{connectionStatus}</div>
                    <div className="spinner" style={{
                      width: '40px',
                      height: '40px',
                      border: '4px solid rgba(255,255,255,0.3)',
                      borderRadius: '50%',
                      borderTop: '4px solid white',
                      animation: 'spin 1s linear infinite'
                    }}></div>
                    <style>{`
                      @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                      }
                    `}</style>
                  </div>
                )}
              </div>
              
              <div style={{ 
                marginTop: '0.5rem', 
                textAlign: 'center',
                fontSize: '0.9rem',
                color: hasVideo || hasAudio ? '#28a745' : '#dc3545'
              }}>
                {hasVideo || hasAudio ? 'Соединение установлено' : connectionStatus}
                {hasVideo && <span> (видео)</span>}
                {hasAudio && <span> (аудио)</span>}
              </div>
              
              <div style={{ 
                marginTop: '1rem', 
                fontSize: '0.8rem', 
                backgroundColor: '#f8f9fa',
                border: '1px solid #dee2e6',
                borderRadius: '0.25rem',
                padding: '0.5rem',
                maxHeight: '100px',
                overflowY: 'auto',
                whiteSpace: 'pre-line',
                display: 'none' // Скрываем отладочную информацию в продакшене
              }}>
                {debugInfo}
              </div>
            </div>
          ) : (
            <div>
              {recordedVideos.length > 0 ? (
                <div>
                  <div style={{ 
                    backgroundColor: '#000', 
                    borderRadius: '0.25rem',
                    height: '300px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    overflow: 'hidden',
                    marginBottom: '1rem'
                  }}>
                    {selectedVideo && (
                      <video 
                        src={selectedVideo.url} 
                        controls 
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    )}
                  </div>
                  
                  <div style={{ 
                    maxHeight: '150px', 
                    overflowY: 'auto',
                    border: '1px solid #dee2e6',
                    borderRadius: '0.25rem',
                    padding: '0.5rem'
                  }}>
                    <h4>Доступные записи:</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {recordedVideos.map((video, index) => (
                        <div 
                          key={index}
                          onClick={() => handleSelectVideo(video)}
                          style={{ 
                            padding: '0.5rem',
                            backgroundColor: selectedVideo === video ? '#e2f0ff' : 'transparent',
                            borderRadius: '0.25rem',
                            cursor: 'pointer',
                            border: '1px solid #dee2e6'
                          }}
                        >
                          {new Date(parseInt(video.name.split('_')[1])).toLocaleString()}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center', 
                  height: '400px',
                  color: '#6c757d'
                }}>
                  Записи не найдены
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallDetails; 