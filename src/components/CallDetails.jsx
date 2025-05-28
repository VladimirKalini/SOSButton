import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../authContext';
import { io } from 'socket.io-client';
import { checkWebRTCSupport, diagnoseWebRTCError, getWebRTCDebugInfo, fixCommonWebRTCIssues, checkWebRTCPorts, checkSignalingServer } from '../scripts/webrtcErrorHandler';

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
  const pendingIceCandidatesRef = useRef([]); // Для хранения кандидатов ICE

  // Добавляем отладочную информацию
  const addDebugInfo = (info) => {
    console.log(info);
    
    // Ограничиваем количество строк в логе (максимум 100 строк)
    setDebugInfo(prev => {
      const lines = prev.split('\n').filter(line => line.trim() !== '');
      
      // Если превышен лимит строк, удаляем старые записи
      if (lines.length >= 100) {
        return [...lines.slice(lines.length - 99), info].join('\n');
      }
      
      // Если строка пустая, начинаем с новой строки
      if (prev === '') {
        return info;
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

    // Инициализация WebRTC с более надежной конфигурацией
    peerRef.current = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { 
          urls: 'turn:numb.viagenie.ca',
          username: 'webrtc@live.com',
          credential: 'muazkh'
        },
        {
          urls: 'turn:turn.anyfirewall.com:443?transport=tcp',
          username: 'webrtc',
          credential: 'webrtc'
        }
      ],
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      iceTransportPolicy: 'all'
    });

    // Настройка обработчиков для peer connection
    setupPeerHandlers();

    // Подключение к Socket.IO с более надежными параметрами
    socketRef.current = io(serverUrl, {
      auth: { token },
      transports: ['polling', 'websocket'], // Сначала polling, затем websocket
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 30000,
      forceNew: true,
      upgrade: true
    });

    // Настройка обработчиков для socket
    socketRef.current.on('connect', () => {
      addDebugInfo(`Socket.IO подключен (id: ${socketRef.current.id}), присоединяемся к комнате: ${id}`);
      socketRef.current.emit('join-room', id);
      
      // Отправляем ping каждые 15 секунд для поддержания соединения
      const pingInterval = setInterval(() => {
        if (socketRef.current && socketRef.current.connected) {
          socketRef.current.emit('ping');
          addDebugInfo('Ping отправлен');
        } else {
          clearInterval(pingInterval);
        }
      }, 15000);
      
      // Очистка интервала при размонтировании
      return () => clearInterval(pingInterval);
    });

    // Настройка обработчиков сокета
    setupSocketHandlers();

    // Создание ответа на offer
    const handleOffer = async () => {
      try {
        addDebugInfo('Обработка offer от клиента');
        
        if (!call || !call.offer) {
          addDebugInfo('Offer отсутствует в данных вызова');
          setError('Не удалось установить видеосвязь: отсутствует offer');
          return;
        }
        
        // Проверяем, что offer имеет правильный формат
        if (!call.offer.type || !call.offer.sdp) {
          addDebugInfo('Offer имеет некорректный формат');
          setError('Не удалось установить видеосвязь: некорректный формат offer');
          return;
        }
        
        // Проверяем, что peerRef.current существует
        if (!peerRef.current) {
          addDebugInfo('Ошибка: peerRef.current отсутствует');
          setError('Не удалось установить видеосвязь: соединение не инициализировано');
          return;
        }
        
        try {
          // Устанавливаем удаленное описание (offer)
          await peerRef.current.setRemoteDescription(new RTCSessionDescription(call.offer));
          addDebugInfo('Remote description установлен');
          
          // Добавляем сохраненные ICE кандидаты, если они есть
          if (pendingIceCandidatesRef.current && pendingIceCandidatesRef.current.length > 0) {
            addDebugInfo(`Добавление ${pendingIceCandidatesRef.current.length} сохраненных ICE кандидатов`);
            for (const candidate of pendingIceCandidatesRef.current) {
              try {
                await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
                addDebugInfo('Сохраненный ICE кандидат успешно добавлен');
              } catch (err) {
                addDebugInfo(`Ошибка при добавлении сохраненного ICE кандидата: ${err.message}`);
              }
            }
            pendingIceCandidatesRef.current = [];
          }
          
          // Создаем ответ
          const answer = await peerRef.current.createAnswer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
          });
          
          // Устанавливаем локальное описание (answer)
          await peerRef.current.setLocalDescription(answer);
          addDebugInfo('Local description установлен');
          
          // Отправляем ответ клиенту
          socketRef.current.emit('sos-answer', { answer, id });
          addDebugInfo('Ответ отправлен клиенту');
          
          setConnectionStatus('Соединение устанавливается...');
        } catch (err) {
          addDebugInfo(`Ошибка при обработке offer: ${err.message}`);
          setError(`Ошибка при установке видеосвязи: ${err.message}`);
        }
      } catch (err) {
        addDebugInfo(`Общая ошибка при обработке offer: ${err.message}`);
        setError(`Ошибка при установке видеосвязи: ${err.message}`);
      }
    };

    if (call.offer) {
      handleOffer();
    } else {
      addDebugInfo('Отсутствует offer для установки соединения');
      setError('Отсутствует offer для установки соединения');
    }

    return () => {
      // Корректное закрытие соединений при размонтировании
      if (peerRef.current) {
        peerRef.current.ontrack = null;
        peerRef.current.onicecandidate = null;
        peerRef.current.oniceconnectionstatechange = null;
        peerRef.current.onsignalingstatechange = null;
        peerRef.current.onconnectionstatechange = null;
        peerRef.current.close();
        peerRef.current = null;
      }
      
      if (socketRef.current) {
        socketRef.current.off('connect');
        socketRef.current.off('ice-candidate');
        socketRef.current.off('sos-canceled');
        socketRef.current.off('sos-reconnect');
        socketRef.current.off('ping');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      
      // Очищаем видеоэлемент
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      
      // Очищаем списки
      processedTracksRef.current.clear();
      pendingIceCandidatesRef.current = [];
    };
  }, [call, id, token, navigate, serverUrl, viewMode]);

  useEffect(() => {
    if (!call || !call.latitude || !call.longitude) return;

    // Используем OpenStreetMap вместо Google Maps (не требует API ключа)
    const createMapWithOSM = () => {
      try {
        addDebugInfo('Инициализация карты OpenStreetMap...');
        
        // Проверяем, не инициализирована ли карта уже
        if (mapRef.current && mapRef.current._leaflet_id) {
          addDebugInfo('Карта уже инициализирована, очищаем контейнер');
          mapRef.current.innerHTML = '';
          if (window.L && window.L.DomEvent) {
            window.L.DomEvent.off(mapRef.current);
          }
        }
        
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
        
        // Очищаем контейнер карты полностью
        mapRef.current.innerHTML = '';
        
        // Удаляем старые обработчики событий, если они есть
        if (window.L && window.L.DomEvent) {
          window.L.DomEvent.off(mapRef.current);
        }
        
        // Проверяем, существует ли уже карта с этим ID
        if (window.mapInstance) {
          window.mapInstance.remove();
          addDebugInfo('Существующая карта удалена');
        }
        
        // Исправляем проблему с иконками Leaflet
        if (window.L && window.L.Icon) {
          window.L.Icon.Default.imagePath = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/';
          
          // Альтернативный вариант - определяем иконки вручную
          window.L.Icon.Default.prototype.options = {
            iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
            iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            tooltipAnchor: [16, -28],
            shadowSize: [41, 41]
          };
        }
        
        // Создаем карту
        const map = window.L.map(mapRef.current).setView([latNum, lngNum], 15);
        window.mapInstance = map; // Сохраняем ссылку на карту
        
        // Добавляем слой OpenStreetMap
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        
        // Добавляем маркер с исправленной иконкой
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
    
    // Очистка при размонтировании
    return () => {
      if (window.L && mapRef.current && mapRef.current._leaflet_id) {
        try {
          window.L.DomEvent.off(mapRef.current);
          mapRef.current._leaflet = null;
        } catch (e) {
          console.error('Ошибка при очистке карты:', e);
        }
      }
    };
  }, [call]);

  const handleCancelCall = async () => {
    try {
      await axios.delete(`/api/calls/${id}/cancel`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Не перенаправляем сразу на главную страницу
      setError('Вызов отменен');
      setTimeout(() => {
        navigate('/');
      }, 3000);
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
    
    // Очищаем список обработанных треков и кандидатов
    processedTracksRef.current.clear();
    pendingIceCandidatesRef.current = [];
    addDebugInfo('Список обработанных треков и кандидатов ICE очищен');
    
    // Закрываем текущее соединение
    if (peerRef.current) {
      try {
        peerRef.current.ontrack = null;
        peerRef.current.onicecandidate = null;
        peerRef.current.oniceconnectionstatechange = null;
        peerRef.current.onsignalingstatechange = null;
        peerRef.current.onconnectionstatechange = null;
        peerRef.current.close();
        peerRef.current = null;
        addDebugInfo('Текущее WebRTC соединение закрыто');
      } catch (err) {
        addDebugInfo(`Ошибка при закрытии WebRTC соединения: ${err.message}`);
      }
    }
    
    // Очищаем видеоэлемент
    if (videoRef.current) {
      if (videoRef.current.srcObject) {
        try {
          const tracks = videoRef.current.srcObject.getTracks();
          tracks.forEach(track => {
            track.stop();
            addDebugInfo(`Трек ${track.kind} остановлен`);
          });
          videoRef.current.srcObject = null;
          addDebugInfo('Видеоэлемент очищен');
        } catch (err) {
          addDebugInfo(`Ошибка при очистке видеоэлемента: ${err.message}`);
        }
      }
    }
    
    // Закрываем текущее соединение с сокетом
    if (socketRef.current) {
      try {
        socketRef.current.off('connect');
        socketRef.current.off('ice-candidate');
        socketRef.current.off('sos-canceled');
        socketRef.current.off('sos-reconnect');
        socketRef.current.off('ping');
        socketRef.current.disconnect();
        socketRef.current = null;
        addDebugInfo('Socket.IO соединение закрыто');
      } catch (err) {
        addDebugInfo(`Ошибка при закрытии Socket.IO соединения: ${err.message}`);
      }
    }
    
    // Сбрасываем состояния
    setHasVideo(false);
    setHasAudio(false);
    setConnectionStatus('Переподключение...');
    setAutoplayBlocked(false);
    
    // Очищаем логи
    setDebugInfo('Логи очищены при переподключении');
    addDebugInfo('Начало процесса переподключения');
    
    // Перезагружаем данные вызова с сервера
    axios.get(`/api/calls/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(response => {
      addDebugInfo('Данные вызова успешно обновлены');
      
      // Создаем новое соединение с сокетом
      socketRef.current = io(serverUrl, {
        auth: { token },
        transports: ['polling', 'websocket'], // Сначала polling, затем websocket
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        timeout: 30000,
        forceNew: true,
        upgrade: true
      });
      
      // Настраиваем обработчики для сокета
      setupSocketHandlers();
      
      // Создаем новое WebRTC соединение
      peerRef.current = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { 
            urls: 'turn:numb.viagenie.ca',
            username: 'webrtc@live.com',
            credential: 'muazkh'
          },
          {
            urls: 'turn:turn.anyfirewall.com:443?transport=tcp',
            username: 'webrtc',
            credential: 'webrtc'
          }
        ],
        iceCandidatePoolSize: 10,
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
        iceTransportPolicy: 'all'
      });
      
      // Настраиваем обработчики для peer connection
      setupPeerHandlers();
      addDebugInfo('Новое WebRTC соединение создано');
      
      // Обрабатываем offer, если он есть
      if (response.data.offer) {
        try {
          // Проверяем, что peerRef.current существует
          if (!peerRef.current) {
            addDebugInfo('Ошибка: peerRef.current отсутствует при обработке offer');
            setError('Не удалось установить видеосвязь: соединение не инициализировано');
            return;
          }
          
          // Устанавливаем удаленное описание (offer)
          peerRef.current.setRemoteDescription(new RTCSessionDescription(response.data.offer))
            .then(() => {
              addDebugInfo('Remote description установлен при переподключении');
              
              // Создаем ответ
              return peerRef.current.createAnswer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
              });
            })
            .then(answer => {
              // Устанавливаем локальное описание (answer)
              return peerRef.current.setLocalDescription(answer)
                .then(() => answer);
            })
            .then(answer => {
              addDebugInfo('Local description (answer) установлен при переподключении');
              
              // Отправляем ответ клиенту
              if (socketRef.current) {
                socketRef.current.emit('sos-answer', { answer, id });
                addDebugInfo('Answer отправлен клиенту при переподключении');
              } else {
                addDebugInfo('Ошибка: socketRef.current отсутствует при отправке ответа');
                setError('Не удалось отправить ответ: соединение с сокетом не инициализировано');
              }
              
              setConnectionStatus('Ожидание соединения после переподключения...');
            })
            .catch(err => {
              addDebugInfo(`Ошибка при установке WebRTC соединения при переподключении: ${err.message}`);
              setError('Не удалось установить видеосвязь: ' + err.message);
            });
        } catch (err) {
          addDebugInfo(`Ошибка при обработке offer при переподключении: ${err.message}`);
          setError('Не удалось установить видеосвязь: ' + err.message);
        }
      } else {
        addDebugInfo('Отсутствует offer для установки соединения при переподключении');
        setError('Отсутствует offer для установки соединения');
      }
    }).catch(err => {
      addDebugInfo(`Ошибка при обновлении данных вызова: ${err.message}`);
      setError('Не удалось обновить данные вызова: ' + err.message);
    });
  };

  // Настройка обработчиков для peer connection
  const setupPeerHandlers = () => {
    if (!peerRef.current) return;
    
    peerRef.current.ontrack = (event) => {
      try {
        addDebugInfo(`Получен медиа-трек: ${event.track.kind}`);
        
        if (event.track.kind === 'video') {
          setHasVideo(true);
          addDebugInfo('Видеотрек получен');
        } else if (event.track.kind === 'audio') {
          setHasAudio(true);
          addDebugInfo('Аудиотрек получен');
        }
        
        // Получаем медиапоток или создаем новый, если его нет
        let stream = event.streams[0];
        
        if (!stream) {
          addDebugInfo('Поток отсутствует в событии track, создаем новый');
          stream = new MediaStream();
          stream.addTrack(event.track);
        }
        
        if (videoRef.current) {
          try {
            // Устанавливаем поток в видеоэлемент
            videoRef.current.srcObject = stream;
            addDebugInfo('Поток установлен в видеоэлемент');
            
            // Настраиваем обработчики для видеоэлемента
            videoRef.current.onloadedmetadata = () => {
              addDebugInfo('Метаданные видео загружены');
              
              // Запускаем воспроизведение
              try {
                // Сначала пробуем с отключенным звуком для обхода ограничений браузера
                videoRef.current.muted = true;
                videoRef.current.play()
                  .then(() => {
                    addDebugInfo('Воспроизведение видео успешно запущено (без звука)');
                    setAutoplayBlocked(false);
                    
                    // Через секунду включаем звук
                    setTimeout(() => {
                      if (videoRef.current) {
                        videoRef.current.muted = false;
                        addDebugInfo('Звук восстановлен после успешного запуска воспроизведения');
                      }
                    }, 1000);
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
          } catch (err) {
            addDebugInfo(`Ошибка при настройке видеоэлемента: ${err.message}`);
          }
        } else {
          addDebugInfo('Ошибка: videoRef.current отсутствует');
        }
        
        // Отслеживаем окончание трека
        event.track.onended = () => {
          addDebugInfo(`Трек ${event.track.kind} завершен`);
          
          if (event.track.kind === 'video') {
            setHasVideo(false);
          } else if (event.track.kind === 'audio') {
            setHasAudio(false);
          }
        };
      } catch (err) {
        addDebugInfo(`Ошибка в обработчике ontrack: ${err.message}`);
      }
    };
    
    peerRef.current.onicecandidate = ({ candidate }) => {
      if (candidate) {
        addDebugInfo(`Сгенерирован ICE кандидат: ${candidate.candidate.split(' ')[0]}`);
        socketRef.current.emit('ice-candidate', { candidate, id });
      }
    };
    
    peerRef.current.onicecandidateerror = (event) => {
      addDebugInfo(`Ошибка ICE кандидата: ${event.errorText || event.error?.errorText || 'Неизвестная ошибка'}`);
    };
    
    peerRef.current.oniceconnectionstatechange = () => {
      try {
        const state = peerRef.current.iceConnectionState;
        addDebugInfo(`ICE состояние изменилось: ${state}`);
        setConnectionStatus(`ICE состояние: ${state}`);
        
        if (state === 'connected' || state === 'completed') {
          setConnectionStatus('Соединение установлено');
          
          // Проверяем наличие треков
          const receivers = peerRef.current.getReceivers();
          addDebugInfo(`Получено ${receivers.length} треков`);
          
          // Если нет видео/аудио треков после успешного соединения, возможно проблема с медиа
          if (receivers.length === 0) {
            addDebugInfo('Предупреждение: соединение установлено, но нет медиа треков');
          }
        } else if (state === 'failed') {
          setError('Соединение не удалось установить. Пробуем переподключиться...');
          addDebugInfo('ICE соединение не удалось установить, пробуем перезапустить ICE');
          
          // Пробуем перезапустить ICE
          try {
            if (peerRef.current && peerRef.current.restartIce) {
              peerRef.current.restartIce();
              addDebugInfo('ICE перезапущен');
            } else {
              addDebugInfo('Функция restartIce недоступна, выполняем полное переподключение');
              setTimeout(() => {
                handleReconnect();
              }, 1000);
            }
          } catch (err) {
            addDebugInfo(`Ошибка при перезапуске ICE: ${err.message}`);
            // Пробуем полное переподключение
            setTimeout(() => {
              handleReconnect();
            }, 1000);
          }
        } else if (state === 'disconnected') {
          setError('Соединение потеряно. Пытаемся восстановить...');
          addDebugInfo('ICE соединение разорвано, ожидаем восстановления...');
          
          // Даем некоторое время на автоматическое восстановление
          setTimeout(() => {
            if (peerRef.current && peerRef.current.iceConnectionState === 'disconnected') {
              addDebugInfo('Соединение не восстановилось автоматически, выполняем переподключение');
              handleReconnect();
            }
          }, 5000);
        }
      } catch (err) {
        addDebugInfo(`Ошибка в обработчике oniceconnectionstatechange: ${err.message}`);
      }
    };
    
    peerRef.current.onicegatheringstatechange = () => {
      const state = peerRef.current.iceGatheringState;
      addDebugInfo(`ICE сбор изменился: ${state}`);
      
      if (state === 'complete') {
        addDebugInfo('Сбор ICE кандидатов завершен');
        
        // Если после завершения сбора ICE соединение все еще не установлено,
        // возможно, проблема с NAT/брандмауэром
        if (peerRef.current.iceConnectionState === 'checking' || 
            peerRef.current.iceConnectionState === 'new') {
          addDebugInfo('Предупреждение: ICE сбор завершен, но соединение не установлено');
          
          // Проверяем наличие srflx или relay кандидатов (STUN/TURN)
          const hasPublicCandidate = pendingIceCandidatesRef.current.some(
            c => c.candidate && (c.candidate.includes('srflx') || c.candidate.includes('relay'))
          );
          
          if (!hasPublicCandidate) {
            addDebugInfo('Предупреждение: не обнаружены публичные ICE кандидаты (srflx/relay)');
            addDebugInfo('Возможно, проблема с доступом к STUN/TURN серверам');
          }
        }
      }
    };
    
    peerRef.current.onsignalingstatechange = () => {
      const state = peerRef.current.signalingState;
      addDebugInfo(`Signaling состояние: ${state}`);
      
      if (state === 'stable') {
        addDebugInfo('Сигнальное соединение стабильно');
      } else if (state === 'closed') {
        addDebugInfo('Сигнальное соединение закрыто');
      }
    };
    
    peerRef.current.onconnectionstatechange = () => {
      const state = peerRef.current.connectionState;
      addDebugInfo(`Connection состояние: ${state}`);
      
      // Если соединение закрыто или не удалось установить, пробуем переподключиться
      if (state === 'failed') {
        addDebugInfo('Соединение не удалось установить');
        setTimeout(() => {
          handleReconnect();
        }, 2000);
      } else if (state === 'connected') {
        addDebugInfo('Соединение успешно установлено');
        
        // Проверяем статистику соединения
        if (peerRef.current.getStats) {
          peerRef.current.getStats().then(stats => {
            let inboundRtpStats = [];
            stats.forEach(stat => {
              if (stat.type === 'inbound-rtp') {
                inboundRtpStats.push(stat);
                addDebugInfo(`Получаем ${stat.kind} поток: ${stat.packetsReceived} пакетов`);
              }
            });
            
            if (inboundRtpStats.length === 0) {
              addDebugInfo('Предупреждение: нет входящих RTP потоков');
            }
          }).catch(err => {
            addDebugInfo(`Ошибка при получении статистики: ${err.message}`);
          });
        }
      }
    };
    
    // Обработка ошибок датаканалов
    peerRef.current.ondatachannel = (event) => {
      const channel = event.channel;
      channel.onerror = (error) => {
        addDebugInfo(`Ошибка датаканала: ${error.message || 'Неизвестная ошибка'}`);
      };
    };
  };

  // Настройка обработчиков сокета
  const setupSocketHandlers = () => {
    if (!socketRef.current) return;
    
    socketRef.current.on('connect_error', (err) => {
      addDebugInfo(`Ошибка подключения Socket.IO: ${err.message}`);
      setError('Не удалось подключиться к серверу');
    });
    
    socketRef.current.on('ice-candidate', async (candidate) => {
      try {
        addDebugInfo(`Получен ICE кандидат от клиента`);
        
        if (peerRef.current && peerRef.current.remoteDescription) {
          await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
          addDebugInfo('ICE кандидат успешно добавлен');
        } else {
          addDebugInfo('Сохраняем ICE кандидат для последующего добавления');
          pendingIceCandidatesRef.current.push(candidate);
        }
      } catch (err) {
        addDebugInfo(`Ошибка при добавлении ICE кандидата: ${err.message}`);
      }
    });
    
    socketRef.current.on('sos-canceled', () => {
      addDebugInfo('Вызов отменен клиентом');
      setConnectionStatus('Вызов отменен');
      
      if (peerRef.current) {
        peerRef.current.close();
      }
      
      setCall(prev => ({ ...prev, status: 'canceled' }));
    });
    
    socketRef.current.on('sos-reconnect', async ({ offer }) => {
      try {
        addDebugInfo('Получен запрос на переподключение');
        await handleReconnectOffer(offer);
      } catch (err) {
        addDebugInfo(`Ошибка при обработке запроса на переподключение: ${err.message}`);
      }
    });
    
    socketRef.current.on('sos-offer', async ({ offer }) => {
      try {
        addDebugInfo('Получен новый offer от клиента');
        await handleReconnectOffer(offer);
      } catch (err) {
        addDebugInfo(`Ошибка при обработке нового offer: ${err.message}`);
      }
    });
    
    socketRef.current.on('ping', () => {
      socketRef.current.emit('pong');
      addDebugInfo('Получен ping, отправлен pong');
    });
    
    socketRef.current.on('disconnect', (reason) => {
      addDebugInfo(`Socket.IO отключен: ${reason}`);
      if (reason === 'io server disconnect' || reason === 'transport close') {
        // Сервер разорвал соединение, пробуем переподключиться
        addDebugInfo('Пробуем переподключиться к серверу...');
        socketRef.current.connect();
      }
    });
    
    socketRef.current.on('error', (error) => {
      addDebugInfo(`Socket.IO ошибка: ${error.message}`);
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
      
      try {
        // Проверяем, есть ли видеопоток
        if (!videoRef.current.srcObject) {
          addDebugInfo('Ошибка: нет видеопотока для воспроизведения');
          setError('Нет видеопотока. Попробуйте переподключиться.');
          return;
        }
        
        // Принудительно включаем автовоспроизведение
        videoRef.current.muted = true; // Временно отключаем звук для обхода ограничений автовоспроизведения
        
        const playPromise = videoRef.current.play();
        
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              addDebugInfo('Воспроизведение успешно запущено вручную');
              setAutoplayBlocked(false);
              
              // Через секунду возвращаем звук
              setTimeout(() => {
                if (videoRef.current) {
                  videoRef.current.muted = false;
                  addDebugInfo('Звук восстановлен после успешного запуска воспроизведения');
                }
              }, 1000);
            })
            .catch(err => {
              addDebugInfo(`Ошибка при ручном запуске воспроизведения: ${err.message}`);
              setError(`Не удалось запустить видео: ${err.message}`);
              
              // Пробуем альтернативный метод запуска
              try {
                // Создаем новый элемент video и пробуем воспроизвести в нем
                const tempVideo = document.createElement('video');
                tempVideo.srcObject = videoRef.current.srcObject;
                tempVideo.muted = true;
                tempVideo.play()
                  .then(() => {
                    // Если успешно, копируем поток обратно
                    if (videoRef.current) {
                      videoRef.current.srcObject = tempVideo.srcObject;
                      videoRef.current.play()
                        .then(() => {
                          addDebugInfo('Воспроизведение запущено альтернативным методом');
                          setAutoplayBlocked(false);
                          setTimeout(() => {
                            if (videoRef.current) videoRef.current.muted = false;
                          }, 1000);
                        });
                    }
                  })
                  .catch(() => {
                    addDebugInfo('Альтернативный метод запуска тоже не сработал');
                  });
              } catch (innerErr) {
                addDebugInfo(`Ошибка альтернативного метода: ${innerErr.message}`);
              }
            });
        }
      } catch (err) {
        addDebugInfo(`Ошибка при запуске видео: ${err.message}`);
        setError(`Ошибка воспроизведения: ${err.message}`);
      }
    }
  };

  // Обработка offer при переподключении
  const handleReconnectOffer = async (offer) => {
    try {
      addDebugInfo('Получен запрос на переподключение с новым offer');
      
      // Всегда пересоздаем соединение при получении нового offer
      addDebugInfo('Пересоздаем WebRTC соединение');
      
      // Закрываем текущее соединение, если оно существует
      if (peerRef.current) {
        try {
          peerRef.current.ontrack = null;
          peerRef.current.onicecandidate = null;
          peerRef.current.oniceconnectionstatechange = null;
          peerRef.current.onsignalingstatechange = null;
          peerRef.current.onconnectionstatechange = null;
          peerRef.current.close();
          addDebugInfo('Существующее WebRTC соединение закрыто');
        } catch (err) {
          addDebugInfo(`Ошибка при закрытии WebRTC соединения: ${err.message}`);
        }
      }
      
      // Очищаем видеоэлемент
      if (videoRef.current && videoRef.current.srcObject) {
        try {
          const tracks = videoRef.current.srcObject.getTracks();
          tracks.forEach(track => {
            track.stop();
            addDebugInfo(`Трек ${track.kind} остановлен`);
          });
          videoRef.current.srcObject = null;
          addDebugInfo('Видеоэлемент очищен');
        } catch (err) {
          addDebugInfo(`Ошибка при очистке видеоэлемента: ${err.message}`);
        }
      }
      
      // Очищаем списки
      processedTracksRef.current.clear();
      pendingIceCandidatesRef.current = [];
      
      // Создаем новое соединение с сокетом, если оно не существует
      if (!socketRef.current) {
        try {
          socketRef.current = io(serverUrl, {
            auth: { token },
            transports: ['polling', 'websocket'], // Сначала polling, затем websocket
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            timeout: 30000,
            forceNew: true,
            upgrade: true
          });
          
          // Настраиваем обработчики для сокета
          setupSocketHandlers();
          addDebugInfo('Новое Socket.IO соединение создано');
        } catch (err) {
          addDebugInfo(`Ошибка при создании Socket.IO соединения: ${err.message}`);
          throw new Error(`Не удалось создать соединение с сокетом: ${err.message}`);
        }
      }
      
      // Создаем новое WebRTC соединение
      try {
        peerRef.current = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { 
              urls: 'turn:numb.viagenie.ca',
              username: 'webrtc@live.com',
              credential: 'muazkh'
            },
            {
              urls: 'turn:turn.anyfirewall.com:443?transport=tcp',
              username: 'webrtc',
              credential: 'webrtc'
            }
          ],
          iceCandidatePoolSize: 10,
          bundlePolicy: 'max-bundle',
          rtcpMuxPolicy: 'require',
          iceTransportPolicy: 'all'
        });
        
        // Настраиваем обработчики для peer connection
        setupPeerHandlers();
        addDebugInfo('Новое WebRTC соединение создано');
      } catch (err) {
        addDebugInfo(`Ошибка при создании WebRTC соединения: ${err.message}`);
        throw new Error(`Не удалось создать WebRTC соединение: ${err.message}`);
      }
      
      // Проверяем, что offer имеет правильный формат
      if (!offer || !offer.type || !offer.sdp) {
        addDebugInfo('Ошибка: полученный offer имеет некорректный формат');
        throw new Error('Некорректный формат offer от клиента');
      }
      
      // Проверяем, что peerRef.current существует
      if (!peerRef.current) {
        addDebugInfo('Ошибка: peerRef.current отсутствует при установке remoteDescription');
        throw new Error('Соединение не инициализировано');
      }
      
      try {
        // Устанавливаем удаленное описание (offer)
        await peerRef.current.setRemoteDescription(new RTCSessionDescription(offer));
        addDebugInfo('Remote description установлен при переподключении');
        
        // Создаем ответ
        const answer = await peerRef.current.createAnswer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });
        
        // Устанавливаем локальное описание (answer)
        await peerRef.current.setLocalDescription(answer);
        addDebugInfo('Local description установлен при переподключении');
        
        // Проверяем, что socketRef.current существует
        if (!socketRef.current) {
          addDebugInfo('Ошибка: socketRef.current отсутствует при отправке ответа');
          throw new Error('Соединение с сокетом не инициализировано');
        }
        
        // Отправляем ответ клиенту
        socketRef.current.emit('sos-answer', { answer, id });
        addDebugInfo('Answer отправлен клиенту при переподключении');
        
        setConnectionStatus('Ожидание соединения после переподключения...');
      } catch (err) {
        addDebugInfo(`Ошибка при установке WebRTC соединения: ${err.message}`);
        throw err;
      }
    } catch (err) {
      addDebugInfo(`Ошибка при обработке запроса на переподключение: ${err.message}`);
      setError('Не удалось переподключиться: ' + err.message);
    }
  };

  // Диагностика WebRTC
  const handleDiagnoseWebRTC = () => {
    try {
      addDebugInfo('Запуск диагностики WebRTC...');
      
      // Проверка поддержки WebRTC
      const support = checkWebRTCSupport();
      addDebugInfo(`Поддержка WebRTC: ${support.supported ? 'Да' : 'Нет'}`);
      addDebugInfo(`- MediaDevices API: ${support.mediaDevices ? 'Да' : 'Нет'}`);
      addDebugInfo(`- PeerConnection API: ${support.peerConnection ? 'Да' : 'Нет'}`);
      addDebugInfo(`- getUserMedia API: ${support.getUserMedia ? 'Да' : 'Нет'}`);
      addDebugInfo(`- MediaRecorder API: ${support.mediaRecorder ? 'Да' : 'Нет'}`);
      addDebugInfo(`- Браузер: ${support.details.browser}`);
      
      if (!support.supported) {
        setError('Ваш браузер не поддерживает WebRTC. Попробуйте использовать Chrome или Firefox.');
        return;
      }
      
      // Проверка текущего соединения
      if (peerRef.current) {
        const debugInfo = getWebRTCDebugInfo(peerRef.current);
        addDebugInfo('Состояние WebRTC соединения:');
        addDebugInfo(`- ICE состояние: ${debugInfo.iceConnectionState}`);
        addDebugInfo(`- ICE сбор: ${debugInfo.iceGatheringState}`);
        addDebugInfo(`- Сигнальное состояние: ${debugInfo.signalingState}`);
        addDebugInfo(`- Состояние соединения: ${debugInfo.connectionState}`);
        
        // Попытка исправить распространенные проблемы
        const fixResult = fixCommonWebRTCIssues(peerRef.current);
        if (fixResult.fixed) {
          addDebugInfo('Выполнены действия для исправления проблем:');
          fixResult.actions.forEach(action => addDebugInfo(`- ${action}`));
        } else if (fixResult.actions.length > 0) {
          addDebugInfo('Не удалось исправить проблемы:');
          fixResult.actions.forEach(action => addDebugInfo(`- ${action}`));
        }
      } else {
        addDebugInfo('WebRTC соединение не инициализировано');
      }
      
      // Проверка сетевого соединения
      addDebugInfo('Проверка сетевого соединения...');
      addDebugInfo(`Онлайн статус: ${navigator.onLine ? 'Подключен' : 'Отключен'}`);
      
      // Рекомендации
      addDebugInfo('Рекомендации:');
      addDebugInfo('1. Убедитесь, что вы используете современный браузер (Chrome, Firefox)');
      addDebugInfo('2. Проверьте доступ к камере и микрофону в настройках браузера');
      addDebugInfo('3. Проверьте сетевое соединение и брандмауэр');
      addDebugInfo('4. Попробуйте перезагрузить страницу');
      
      setShowFullDebug(true);
    } catch (err) {
      addDebugInfo(`Ошибка при диагностике: ${err.message}`);
    }
  };

  // Проверка сетевого соединения для WebRTC
  const handleCheckNetwork = async () => {
    try {
      addDebugInfo('Запуск проверки сетевого соединения...');
      
      // Проверка базового онлайн-статуса
      addDebugInfo(`Онлайн статус: ${navigator.onLine ? 'Подключен' : 'Отключен'}`);
      
      // Проверка доступности сервера
      addDebugInfo('Проверка доступности сервера...');
      try {
        const response = await axios.get(`${serverUrl}/api/status`);
        addDebugInfo(`Сервер доступен: ${response.data.status}`);
      } catch (err) {
        addDebugInfo(`Ошибка доступности сервера: ${err.message}`);
      }
      
      // Проверка соединения с сигнальным сервером
      addDebugInfo('Проверка соединения с сигнальным сервером...');
      const signalingCheck = await checkSignalingServer(serverUrl);
      if (signalingCheck.connected) {
        addDebugInfo(`Socket.IO соединение: Подключено (ID: ${signalingCheck.socketId})`);
      } else {
        addDebugInfo(`Socket.IO соединение: Ошибка - ${signalingCheck.error}`);
      }
      
      // Проверка портов WebRTC
      addDebugInfo('Проверка портов WebRTC...');
      const portsCheck = await checkWebRTCPorts();
      
      if (portsCheck.error) {
        addDebugInfo(`Ошибка при проверке портов: ${portsCheck.error}`);
      } else {
        addDebugInfo(`UDP заблокирован: ${portsCheck.udpBlocked ? 'Да' : 'Нет'}`);
        addDebugInfo(`STUN порты заблокированы: ${portsCheck.stunPortsBlocked ? 'Да' : 'Нет'}`);
        addDebugInfo(`TURN порты заблокированы: ${portsCheck.turnPortsBlocked ? 'Да' : 'Нет'}`);
        
        if (portsCheck.details.candidateTypes) {
          addDebugInfo(`Типы кандидатов: host=${portsCheck.details.candidateTypes.host}, srflx=${portsCheck.details.candidateTypes.srflx}, relay=${portsCheck.details.candidateTypes.relay}`);
        }
      }
      
      // Рекомендации
      addDebugInfo('Рекомендации:');
      if (portsCheck.udpBlocked) {
        addDebugInfo('1. Проверьте настройки брандмауэра - UDP трафик заблокирован');
      }
      if (portsCheck.stunPortsBlocked) {
        addDebugInfo('2. Проверьте доступность STUN серверов (порты 19302, 3478)');
      }
      if (portsCheck.turnPortsBlocked) {
        addDebugInfo('3. Проверьте доступность TURN серверов');
      }
      if (!signalingCheck.connected) {
        addDebugInfo('4. Проверьте соединение с сигнальным сервером');
      }
      
      // Общий вывод
      if (!portsCheck.udpBlocked && !portsCheck.stunPortsBlocked && signalingCheck.connected) {
        addDebugInfo('Сетевое соединение в порядке. Если проблемы с видео сохраняются, проблема может быть в другом месте.');
      } else {
        addDebugInfo('Обнаружены проблемы с сетевым соединением. Следуйте рекомендациям выше.');
      }
    } catch (err) {
      addDebugInfo(`Ошибка при проверке сети: ${err.message}`);
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
                    <div style={{ marginBottom: '1rem' }}>Автовоспроизведение заблокировано браузером</div>
                    <button 
                      onClick={handleManualPlay}
                      style={{ 
                        padding: '0.5rem 1rem', 
                        backgroundColor: '#007bff', 
                        color: 'white', 
                        border: 'none',
                        borderRadius: '0.25rem',
                        cursor: 'pointer'
                      }}
                    >
                      Запустить видео
                    </button>
                  </div>
                )}
              </div>
              
              <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between' }}>
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
                  Очистить логи
                </button>
              </div>
              
              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button 
                  onClick={handleReconnect}
                  style={{ 
                    padding: '0.5rem 1rem', 
                    backgroundColor: '#007bff', 
                    color: 'white', 
                    border: 'none',
                    borderRadius: '0.25rem',
                    cursor: 'pointer'
                  }}
                >
                  Принудительное обновление соединения
                </button>
                
                <button 
                  onClick={handleDiagnoseWebRTC}
                  style={{ 
                    padding: '0.5rem 1rem', 
                    backgroundColor: '#28a745', 
                    color: 'white', 
                    border: 'none',
                    borderRadius: '0.25rem',
                    cursor: 'pointer'
                  }}
                >
                  Диагностика WebRTC
                </button>
                
                <button 
                  onClick={handleCheckNetwork}
                  style={{ 
                    padding: '0.5rem 1rem', 
                    backgroundColor: '#fd7e14', 
                    color: 'white', 
                    border: 'none',
                    borderRadius: '0.25rem',
                    cursor: 'pointer'
                  }}
                >
                  Проверка сетевого соединения
                </button>
                
                <button 
                  onClick={clearDebugInfo}
                  style={{ 
                    padding: '0.5rem 1rem', 
                    backgroundColor: '#6c757d', 
                    color: 'white', 
                    border: 'none',
                    borderRadius: '0.25rem',
                    cursor: 'pointer'
                  }}
                >
                  Очистить логи
                </button>
                
                <button 
                  onClick={toggleDebugModal}
                  style={{ 
                    padding: '0.5rem 1rem', 
                    backgroundColor: '#17a2b8', 
                    color: 'white', 
                    border: 'none',
                    borderRadius: '0.25rem',
                    cursor: 'pointer'
                  }}
                >
                  {showFullDebug ? 'Скрыть отладочную информацию' : 'Показать отладочную информацию'}
                </button>
              </div>
              
              {showFullDebug && (
                <div style={{ 
                  marginTop: '1rem',
                  padding: '1rem',
                  backgroundColor: '#212529',
                  color: '#f8f9fa',
                  borderRadius: '0.25rem',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all'
                }}>
                  {debugInfo || 'Нет отладочной информации'}
                </div>
              )}
            </div>
          ) : (
            <div>
              {recordedVideos.length > 0 ? (
                <div>
                  <div style={{ marginBottom: '1rem' }}>
                    {recordedVideos.map(video => (
                      <button 
                        key={video.id}
                        onClick={() => handleSelectVideo(video)}
                        style={{ 
                          padding: '0.5rem 1rem', 
                          backgroundColor: selectedVideo === video ? '#007bff' : '#f8f9fa',
                          color: selectedVideo === video ? 'white' : '#6c757d',
                          border: '1px solid #dee2e6',
                          borderRadius: '0.25rem',
                          cursor: 'pointer',
                          marginRight: '0.5rem',
                          marginBottom: '0.5rem'
                        }}
                      >
                        {video.title || new Date(video.createdAt).toLocaleString()}
                      </button>
                    ))}
                  </div>
                  
                  {selectedVideo && (
                    <div>
                      <video 
                        src={`/api/calls/${id}/video/${selectedVideo.id}`}
                        controls
                        style={{ width: '100%', borderRadius: '0.25rem' }}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center', 
                  height: '200px',
                  color: '#6c757d'
                }}>
                  Нет записанных видео
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