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
  const [showFullDebug, setShowFullDebug] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const processedTracksRef = useRef(new Set()); // Для отслеживания уже обработанных треков

  // Добавляем отладочную информацию
  const addDebugInfo = (info) => {
    console.log(info);
    
    // Ограничиваем количество строк в логе (максимум 100 строк)
    setDebugInfo(prev => {
      const lines = prev.split('\n');
      if (lines.length > 100) {
        // Оставляем только последние 100 строк
        return [...lines.slice(lines.length - 99), info].join('\n');
      }
      return `${prev}\n${info}`;
    });
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
      ],
      iceTransportPolicy: 'all',
      iceCandidatePoolSize: 10
    });

    peerRef.current.ontrack = (event) => {
      // Проверяем, не обрабатывали ли мы уже этот трек
      const trackId = event.track.id;
      if (processedTracksRef.current.has(trackId)) {
        // Трек уже был обработан, пропускаем
        return;
      }
      
      // Добавляем трек в список обработанных
      processedTracksRef.current.add(trackId);
      
      addDebugInfo(`Получен медиа-трек: ${event.track.kind}, id: ${trackId}`);
      
      if (event.track.kind === 'video') {
        setHasVideo(true);
      } else if (event.track.kind === 'audio') {
        setHasAudio(true);
      }
      
      if (videoRef.current) {
        // Проверяем, есть ли уже видеопоток
        const currentStream = videoRef.current.srcObject;
        
        // Если поток уже установлен, добавляем трек к существующему потоку
        if (currentStream) {
          addDebugInfo('Добавление трека к существующему потоку');
          // Не заменяем поток, если он уже есть
        } else {
          // Устанавливаем новый поток
          videoRef.current.srcObject = event.streams[0];
          addDebugInfo('Установлен новый видеопоток');
          
          // Настраиваем обработчики для видеоэлемента
          videoRef.current.onloadedmetadata = () => {
            addDebugInfo('Метаданные видео загружены');
            
            // Используем Promise для обработки воспроизведения
            const playPromise = videoRef.current.play();
            
            if (playPromise !== undefined) {
              playPromise
                .then(() => {
                  addDebugInfo('Воспроизведение видео успешно запущено');
                  setAutoplayBlocked(false);
                })
                .catch(err => {
                  addDebugInfo(`Ошибка воспроизведения: ${err.message}`);
                  
                  // Если ошибка связана с автовоспроизведением, добавляем кнопку для ручного запуска
                  if (err.name === 'NotAllowedError') {
                    addDebugInfo('Автовоспроизведение заблокировано браузером');
                    setAutoplayBlocked(true);
                  }
                });
            }
          };
          
          // Обработка ошибок
          videoRef.current.onerror = (e) => {
            addDebugInfo(`Ошибка видеоэлемента: ${e.target.error ? e.target.error.message : 'Неизвестная ошибка'}`);
          };
        }
      } else {
        addDebugInfo('Ошибка: videoRef.current отсутствует');
      }
      
      // Отслеживаем окончание трека
      event.track.onended = () => {
        addDebugInfo(`Трек ${event.track.kind} завершен`);
        // Удаляем трек из списка обработанных, чтобы можно было обработать новый трек с тем же ID
        processedTracksRef.current.delete(trackId);
      };
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

    peerRef.current.onconnectionstatechange = () => {
      addDebugInfo(`Connection состояние: ${peerRef.current.connectionState}`);
    };

    // Подключение к Socket.IO
    socketRef.current = io(serverUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000
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

    // Обработка переподключения клиента
    socketRef.current.on('sos-reconnect', async ({ offer, id: reconnectId }) => {
      addDebugInfo(`Получен запрос на переподключение от клиента: ${reconnectId}`);
      if (reconnectId === id) {
        try {
          // Закрываем текущее соединение
          if (peerRef.current) {
            peerRef.current.close();
          }
          
          // Очищаем список обработанных треков
          processedTracksRef.current.clear();
          
          // Создаем новое соединение
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
          
          // Настраиваем обработчики событий
          peerRef.current.ontrack = (event) => {
            // Проверяем, не обрабатывали ли мы уже этот трек
            const trackId = event.track.id;
            if (processedTracksRef.current.has(trackId)) {
              // Трек уже был обработан, пропускаем
              return;
            }
            
            // Добавляем трек в список обработанных
            processedTracksRef.current.add(trackId);
            
            addDebugInfo(`Получен медиа-трек после переподключения: ${event.track.kind}, id: ${trackId}`);
            
            if (event.track.kind === 'video') {
              setHasVideo(true);
            } else if (event.track.kind === 'audio') {
              setHasAudio(true);
            }
            
            if (videoRef.current) {
              // Проверяем, есть ли уже видеопоток
              const currentStream = videoRef.current.srcObject;
              
              // Если поток уже установлен, добавляем трек к существующему потоку
              if (currentStream) {
                addDebugInfo('Добавление трека к существующему потоку после переподключения');
                // Не заменяем поток, если он уже есть
              } else {
                // Устанавливаем новый поток
                videoRef.current.srcObject = event.streams[0];
                addDebugInfo('Установлен новый видеопоток после переподключения');
                
                // Настраиваем обработчики для видеоэлемента
                videoRef.current.onloadedmetadata = () => {
                  addDebugInfo('Метаданные видео загружены после переподключения');
                  
                  // Используем Promise для обработки воспроизведения
                  const playPromise = videoRef.current.play();
                  
                  if (playPromise !== undefined) {
                    playPromise
                      .then(() => {
                        addDebugInfo('Воспроизведение видео успешно запущено после переподключения');
                        setAutoplayBlocked(false);
                      })
                      .catch(err => {
                        addDebugInfo(`Ошибка воспроизведения после переподключения: ${err.message}`);
                        
                        // Если ошибка связана с автовоспроизведением, показываем кнопку для ручного запуска
                        if (err.name === 'NotAllowedError') {
                          addDebugInfo('Автовоспроизведение заблокировано браузером после переподключения');
                          setAutoplayBlocked(true);
                        }
                      });
                  }
                };
              }
            }
            
            // Отслеживаем окончание трека
            event.track.onended = () => {
              addDebugInfo(`Трек ${event.track.kind} завершен после переподключения`);
              // Удаляем трек из списка обработанных
              processedTracksRef.current.delete(trackId);
            };
          };
          
          peerRef.current.oniceconnectionstatechange = () => {
            const state = peerRef.current.iceConnectionState;
            addDebugInfo(`ICE состояние изменилось: ${state}`);
            setConnectionStatus(`ICE состояние: ${state}`);
          };
          
          peerRef.current.onsignalingstatechange = () => {
            addDebugInfo(`Signaling состояние: ${peerRef.current.signalingState}`);
          };
          
          peerRef.current.onicecandidate = ({ candidate }) => {
            if (candidate) {
              addDebugInfo('Отправка ICE кандидата клиенту');
              socketRef.current.emit('ice-candidate', { candidate, id });
            }
          };
          
          // Устанавливаем удаленное описание
          await peerRef.current.setRemoteDescription(new RTCSessionDescription(offer));
          addDebugInfo('Remote description установлен');
          
          // Создаем ответ
          const answer = await peerRef.current.createAnswer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
          });
          await peerRef.current.setLocalDescription(answer);
          addDebugInfo('Local description (answer) установлен');
          
          // Отправляем ответ клиенту
          socketRef.current.emit('sos-answer', { answer, id });
          addDebugInfo('Answer отправлен клиенту после переподключения');
          
          setConnectionStatus('Ожидание соединения после переподключения...');
        } catch (err) {
          addDebugInfo(`Ошибка при переподключении: ${err.message}`);
          setError('Не удалось переподключиться: ' + err.message);
        }
      }
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
        
        // Очищаем предыдущее соединение, если оно есть
        if (peerRef.current) {
          peerRef.current.close();
          peerRef.current = null;
        }
        
        // Очищаем список обработанных треков
        processedTracksRef.current.clear();
        
        // Создаем новое соединение
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
        
        // Настраиваем обработчик для медиа-треков
        peerRef.current.ontrack = (event) => {
          // Проверяем, не обрабатывали ли мы уже этот трек
          const trackId = event.track.id;
          if (processedTracksRef.current.has(trackId)) {
            // Трек уже был обработан, пропускаем
            return;
          }
          
          // Добавляем трек в список обработанных
          processedTracksRef.current.add(trackId);
          
          addDebugInfo(`Получен медиа-трек: ${event.track.kind}, id: ${trackId}`);
          
          if (event.track.kind === 'video') {
            setHasVideo(true);
          } else if (event.track.kind === 'audio') {
            setHasAudio(true);
          }
          
          // Получаем медиапоток
          const stream = event.streams[0];
          
          if (videoRef.current) {
            // Устанавливаем поток в видеоэлемент
            videoRef.current.srcObject = stream;
            addDebugInfo('Видеопоток установлен в элемент video');
            
            // Настраиваем обработчики для видеоэлемента
            videoRef.current.onloadedmetadata = () => {
              addDebugInfo('Метаданные видео загружены');
              
              // Запускаем воспроизведение
              try {
                videoRef.current.play()
                  .then(() => {
                    addDebugInfo('Воспроизведение видео успешно запущено');
                    setAutoplayBlocked(false);
                  })
                  .catch(err => {
                    addDebugInfo(`Ошибка воспроизведения: ${err.message}`);
                    
                    // Если ошибка связана с автовоспроизведением, показываем кнопку для ручного запуска
                    if (err.name === 'NotAllowedError') {
                      addDebugInfo('Автовоспроизведение заблокировано браузером');
                      setAutoplayBlocked(true);
                    }
                  });
              } catch (err) {
                addDebugInfo(`Ошибка при запуске воспроизведения: ${err.message}`);
              }
            };
            
            // Обработка ошибок
            videoRef.current.onerror = (e) => {
              addDebugInfo(`Ошибка видеоэлемента: ${e.target.error ? e.target.error.message : 'Неизвестная ошибка'}`);
            };
          } else {
            addDebugInfo('Ошибка: videoRef.current отсутствует');
          }
          
          // Отслеживаем окончание трека
          event.track.onended = () => {
            addDebugInfo(`Трек ${event.track.kind} завершен`);
            // Удаляем трек из списка обработанных
            processedTracksRef.current.delete(trackId);
          };
        };
        
        // Настраиваем обработчики событий
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
        
        peerRef.current.onconnectionstatechange = () => {
          addDebugInfo(`Connection состояние: ${peerRef.current.connectionState}`);
        };
        
        // Обработчик ICE кандидатов
        peerRef.current.onicecandidate = ({ candidate }) => {
          if (candidate) {
            addDebugInfo('Отправка ICE кандидата клиенту');
            socketRef.current.emit('ice-candidate', { candidate, id });
          }
        };

        // Устанавливаем удаленное описание (offer)
        await peerRef.current.setRemoteDescription(new RTCSessionDescription(call.offer));
        addDebugInfo('Remote description установлен');
        
        // Создаем ответ
        const answer = await peerRef.current.createAnswer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });
        
        // Устанавливаем локальное описание (answer)
        await peerRef.current.setLocalDescription(answer);
        addDebugInfo('Local description (answer) установлен');
        
        // Отправляем ответ клиенту
        socketRef.current.emit('sos-answer', { answer, id });
        addDebugInfo('Answer отправлен клиенту');
        
        setConnectionStatus('Ожидание соединения...');
        
        // Проверяем состояние соединения через некоторое время
        setTimeout(() => {
          if (peerRef.current) {
            const state = peerRef.current.iceConnectionState;
            addDebugInfo(`Проверка состояния ICE: ${state}`);
            
            if (state !== 'connected' && state !== 'completed') {
              addDebugInfo('Соединение не установлено, пробуем переподключиться');
              handleReconnect();
            }
          }
        }, 15000);
        
        // Устанавливаем таймаут для проверки соединения
        setTimeout(() => {
          if (!hasVideo && !hasAudio && peerRef.current) {
            addDebugInfo('Таймаут: нет медиа-треков. Пробуем переподключиться...');
            handleReconnect(); // Пробуем переподключиться
          }
        }, 10000);
      } catch (err) {
        addDebugInfo(`Ошибка при установке WebRTC соединения: ${err.message}`);
        setError('Не удалось установить видеосвязь: ' + err.message);
        
        // Пробуем переподключиться после ошибки
        setTimeout(() => {
          handleReconnect();
        }, 3000);
      }
    };

    if (call.offer) {
      handleOffer();
    } else {
      addDebugInfo('Отсутствует offer для установки соединения');
      setError('Отсутствует offer для установки соединения');
    }

    // Обработка пинга для поддержания соединения
    socketRef.current.on('ping', () => {
      socketRef.current.emit('pong');
    });

    return () => {
      if (peerRef.current) {
        peerRef.current.close();
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [call, id, token, navigate, serverUrl, viewMode, hasVideo, hasAudio]);

  useEffect(() => {
    if (!call || !call.latitude || !call.longitude) return;

    // Используем OpenStreetMap вместо Google Maps (не требует API ключа)
    const createMapWithOSM = () => {
      try {
        addDebugInfo('Инициализация карты OpenStreetMap...');
        // Проверяем, загружен ли Leaflet
        if (!window.L) {
          addDebugInfo('Загрузка библиотеки Leaflet...');
          // Загружаем CSS для Leaflet
          const linkElement = document.createElement('link');
          linkElement.rel = 'stylesheet';
          linkElement.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          linkElement.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
          linkElement.crossOrigin = '';
          document.head.appendChild(linkElement);
          
          // Загружаем JavaScript для Leaflet
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
          script.crossOrigin = '';
          script.onload = () => {
            addDebugInfo('Библиотека Leaflet загружена');
            initializeOSMap(call.latitude, call.longitude);
          };
          document.head.appendChild(script);
        } else {
          initializeOSMap(call.latitude, call.longitude);
        }
      } catch (error) {
        console.error('Ошибка при создании карты:', error);
        addDebugInfo(`Ошибка при создании карты: ${error.message}`);
      }
    };

    const initializeOSMap = (lat, lng) => {
      if (!mapRef.current) {
        addDebugInfo('Ошибка: mapRef.current отсутствует');
        return;
      }
      
      try {
        addDebugInfo(`Инициализация карты с координатами: ${lat}, ${lng}`);
        const latNum = parseFloat(lat);
        const lngNum = parseFloat(lng);
        
        if (isNaN(latNum) || isNaN(lngNum)) {
          console.error('Некорректные координаты:', lat, lng);
          addDebugInfo(`Некорректные координаты: ${lat}, ${lng}`);
          return;
        }
        
        // Очищаем контейнер карты, если там уже есть карта
        mapRef.current.innerHTML = '';
        
        // Создаем карту
        const map = window.L.map(mapRef.current).setView([latNum, lngNum], 15);
        
        // Добавляем слой OpenStreetMap
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        
        // Добавляем маркер
        const marker = window.L.marker([latNum, lngNum]).addTo(map);
        marker.bindPopup("SOS местоположение").openPopup();
        
        mapMarkerRef.current = marker;
        
        console.log('Карта OpenStreetMap успешно инициализирована');
        addDebugInfo('Карта успешно инициализирована');
        
        // Принудительно обновляем размер карты после рендеринга
        setTimeout(() => {
          if (map) {
            map.invalidateSize();
            addDebugInfo('Размер карты обновлен');
          }
        }, 500);
      } catch (error) {
        console.error('Ошибка при инициализации карты:', error);
        addDebugInfo(`Ошибка при инициализации карты: ${error.message}`);
      }
    };
    
    createMapWithOSM();
  }, [call]);

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

  // Принудительное переподключение видеотрансляции
  const handleReconnect = () => {
    addDebugInfo('Инициирована попытка переподключения вручную');
    
    // Проверяем поддержку WebRTC браузером
    if (!navigator.mediaDevices || !window.RTCPeerConnection) {
      addDebugInfo('Ошибка: браузер не поддерживает WebRTC');
      setError('Ваш браузер не поддерживает WebRTC. Попробуйте использовать Chrome или Firefox.');
      return;
    }
    
    // Очищаем список обработанных треков
    processedTracksRef.current.clear();
    addDebugInfo('Список обработанных треков очищен');
    
    // Закрываем текущее соединение
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }
    
    // Очищаем видеоэлемент
    if (videoRef.current) {
      if (videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => {
          track.stop();
          addDebugInfo(`Трек ${track.kind} остановлен`);
        });
        videoRef.current.srcObject = null;
      }
    }
    
    // Сбрасываем состояния
    setHasVideo(false);
    setHasAudio(false);
    setConnectionStatus('Переподключение...');
    setAutoplayBlocked(false);
    
    // Перезагружаем данные вызова с сервера
    axios.get(`/api/calls/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(response => {
      addDebugInfo('Данные вызова успешно обновлены');
      setCall(response.data);
    }).catch(err => {
      addDebugInfo(`Ошибка при обновлении данных вызова: ${err.message}`);
      // Даже если не удалось обновить данные, пробуем переподключиться с текущими данными
      setCall(prev => ({...prev}));
    });
  };

  // Очистка отладочной информации
  const clearDebugInfo = () => {
    setDebugInfo('');
  };

  // Отображение отладочной информации в модальном окне
  const toggleDebugModal = () => {
    setShowFullDebug(!showFullDebug);
  };

  // Ручной запуск воспроизведения видео
  const handleManualPlay = () => {
    if (videoRef.current) {
      addDebugInfo('Попытка ручного запуска воспроизведения');
      
      const playPromise = videoRef.current.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            addDebugInfo('Воспроизведение успешно запущено вручную');
            setAutoplayBlocked(false);
          })
          .catch(err => {
            addDebugInfo(`Ошибка при ручном запуске воспроизведения: ${err.message}`);
          });
      }
    }
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
            
            <div>
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
                    fontSize: '0.9rem',
                    marginRight: '0.5rem'
                  }}
                >
                  {viewMode === 'live' ? 'Архивные записи' : 'Прямая трансляция'}
                </button>
              )}
              
              {viewMode === 'live' && (
                <button 
                  onClick={handleReconnect}
                  style={{ 
                    padding: '0.5rem 1rem', 
                    backgroundColor: '#28a745', 
                    color: 'white', 
                    border: 'none',
                    borderRadius: '0.25rem',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  Переподключить
                </button>
              )}
            </div>
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
                  muted={false}
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
                
                {autoplayBlocked && (
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
                    <div style={{ marginBottom: '1rem', textAlign: 'center' }}>
                      Автовоспроизведение видео заблокировано браузером
                    </div>
                    <button 
                      onClick={handleManualPlay}
                      style={{ 
                        padding: '0.75rem 1.5rem', 
                        backgroundColor: '#28a745', 
                        color: 'white', 
                        border: 'none',
                        borderRadius: '0.25rem',
                        cursor: 'pointer',
                        fontSize: '1rem'
                      }}
                    >
                      Запустить видео
                    </button>
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
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
                <button 
                  onClick={handleReconnect}
                  style={{ 
                    padding: '0.5rem 1rem', 
                    backgroundColor: '#28a745', 
                    color: 'white', 
                    border: 'none',
                    borderRadius: '0.25rem',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  Переподключить
                </button>
                
                <button 
                  onClick={handleManualPlay}
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
                  Запустить видео
                </button>
                
                <button 
                  onClick={toggleDebugModal}
                  style={{ 
                    padding: '0.5rem 1rem', 
                    backgroundColor: '#6c757d', 
                    color: 'white', 
                    border: 'none',
                    borderRadius: '0.25rem',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  {showFullDebug ? 'Скрыть отладку' : 'Показать отладку'}
                </button>
                
                <button 
                  onClick={clearDebugInfo}
                  style={{ 
                    padding: '0.5rem 1rem', 
                    backgroundColor: '#dc3545', 
                    color: 'white', 
                    border: 'none',
                    borderRadius: '0.25rem',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  Очистить лог
                </button>
              </div>
              
              {showFullDebug && (
                <div style={{ 
                  marginTop: '1rem', 
                  fontSize: '0.8rem', 
                  backgroundColor: '#f8f9fa',
                  border: '1px solid #dee2e6',
                  borderRadius: '0.25rem',
                  padding: '0.5rem',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  whiteSpace: 'pre-line'
                }}>
                  {debugInfo}
                </div>
              )}
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