import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';

export function SOSButton({ token, userPhone, serverUrl = 'https://1fxpro.vip' }) {
  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const streamRef = useRef(null);
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [sosId, setSosId] = useState(null);
  const [location, setLocation] = useState(null);
  const [backgroundMode, setBackgroundMode] = useState(false);
  const wakeLockRef = useRef(null);
  const [debugMessage, setDebugMessage] = useState('');

  useEffect(() => {
    socketRef.current = io(serverUrl, { 
      auth: { token }, 
      transports: ['websocket'] 
    });

    socketRef.current.on('connect', () => {
      console.log('Socket.IO подключен');
    });

    socketRef.current.on('connect_error', (err) => {
      console.error('Ошибка подключения Socket.IO:', err);
      setError('Не удалось подключиться к серверу');
    });
    
    socketRef.current.on('sos-answer', async ({ answer }) => { 
      try {
        console.log('Получен ответ SOS:', answer);
        if (peerRef.current && peerRef.current.signalingState !== 'closed') {
          await peerRef.current.setRemoteDescription(new RTCSessionDescription(answer));
          console.log('Remote description установлен успешно');
        }
      } catch (e) {
        console.error('Ошибка при установке ответа:', e);
      } 
    });
    
    socketRef.current.on('ice-candidate', async (candidate) => {
      try {
        console.log('Получен ICE кандидат:', candidate);
        if (peerRef.current && peerRef.current.remoteDescription) {
          await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
          console.log('ICE кандидат добавлен успешно');
        } else {
          console.warn('Не удалось добавить ICE кандидата: peer не инициализирован или нет remoteDescription');
        }
      } catch (err) {
        console.error('Ошибка при добавлении ICE кандидата:', err);
      }
    });
    
    socketRef.current.on('sos-canceled', () => {
      console.log('SOS вызов отменен');
      releaseWakeLock();
      stopStreaming();
      setError('SOS вызов был отменен охраной');
    });

    socketRef.current.on('sos-saved', ({ id }) => {
      console.log('SOS сохранен с ID:', id);
      setSosId(id);
      
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'inactive') {
        startRecording(id);
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [serverUrl, token]);

  const startRecording = (id) => {
    try {
      if (!streamRef.current) {
        console.error('Нет медиапотока для записи');
        return;
      }
      
      const options = { mimeType: 'video/webm;codecs=vp9,opus' };
      mediaRecorderRef.current = new MediaRecorder(streamRef.current, options);
      
      const chunks = [];
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
          
          const formData = new FormData();
          formData.append('videoChunk', new Blob([e.data], { type: 'video/webm' }));
          formData.append('sosId', id);
          
          axios.post('/api/calls/record', formData, {
            headers: { 
              'Content-Type': 'multipart/form-data',
              Authorization: `Bearer ${token}`
            }
          }).then(() => {
            console.log('Видеофрагмент отправлен успешно');
          }).catch(err => {
            console.error('Ошибка при отправке видео:', err);
          });
        }
      };
      
      mediaRecorderRef.current.start(10000);
      console.log('Запись видео начата');
    } catch (err) {
      console.error('Ошибка при запуске записи:', err);
    }
  };

  const requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        console.log('Wake Lock активирован');
        
        wakeLockRef.current.addEventListener('release', () => {
          console.log('Wake Lock был отключен');
        });
      } catch (err) {
        console.error(`Ошибка при запросе Wake Lock: ${err.name}, ${err.message}`);
      }
    } else {
      console.warn('Wake Lock API не поддерживается в этом браузере.');
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release()
        .then(() => {
          wakeLockRef.current = null;
        })
        .catch((err) => {
          console.error(`Ошибка при освобождении Wake Lock: ${err.name}, ${err.message}`);
        });
    }
  };

  const stopStreaming = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      console.log('Запись остановлена');
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      console.log('Медиапотоки остановлены');
    }
    
    if (peerRef.current) {
      peerRef.current.close();
      console.log('WebRTC соединение закрыто');
    }
    
    setSending(false);
    setStreaming(false);
    setSosId(null);
    setLocation(null);
    setBackgroundMode(false);
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && streaming) {
        setBackgroundMode(true);
      } else if (document.visibilityState === 'visible' && backgroundMode) {
        setBackgroundMode(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [streaming, backgroundMode]);

  const handleSOS = async () => {
    if (sending && sosId) {
      try {
        await axios.delete(`/api/calls/${sosId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        releaseWakeLock();
        stopStreaming();
        return;
      } catch (err) {
        setError('Не удалось отменить SOS вызов');
        console.error(err);
        return;
      }
    }

    setError('');
    setDebugMessage('Инициализация SOS...');
    setSending(true);

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const { latitude, longitude } = coords;
        setLocation({ latitude, longitude });
        setDebugMessage('Геолокация получена');
        
        try {
          await requestWakeLock();
          
          setDebugMessage('Запрашиваем доступ к камере...');
          streamRef.current = await navigator.mediaDevices.getUserMedia({ 
            video: { 
              facingMode: 'environment',
              width: { ideal: 1280 },
              height: { ideal: 720 }
            }, 
            audio: true 
          });
          
          if (videoRef.current) {
            videoRef.current.srcObject = streamRef.current;
            videoRef.current.muted = true;
          }
          
          setDebugMessage('Доступ к камере получен');
          
          peerRef.current = new RTCPeerConnection({ 
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' }
            ] 
          });
          
          peerRef.current.onicecandidate = ({ candidate }) => {
            if (candidate && socketRef.current && sosId) {
              console.log('Отправка ICE кандидата:', candidate);
              socketRef.current.emit('ice-candidate', { candidate, id: sosId });
            }
          };
          
          peerRef.current.oniceconnectionstatechange = () => {
            console.log('ICE состояние:', peerRef.current.iceConnectionState);
            setDebugMessage(`ICE состояние: ${peerRef.current.iceConnectionState}`);
          };
          
          peerRef.current.onsignalingstatechange = () => {
            console.log('Signaling состояние:', peerRef.current.signalingState);
          };
          
          streamRef.current.getTracks().forEach(track => {
            peerRef.current.addTrack(track, streamRef.current);
            console.log('Трек добавлен:', track.kind);
          });
          
          setDebugMessage('WebRTC соединение инициализировано');

          const offer = await peerRef.current.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
          });
          
          await peerRef.current.setLocalDescription(offer);
          console.log('Local description установлен:', offer);
          
          setDebugMessage('Отправка SOS сигнала...');
          socketRef.current.emit('sos-offer', { 
            offer, 
            latitude, 
            longitude, 
            phone: userPhone 
          });
          
          setStreaming(true);
          setDebugMessage('SOS сигнал отправлен');
        } catch (err) {
          setError(`Не удалось запустить камеру или соединение: ${err.message}`);
          setSending(false);
          console.error('Ошибка при инициализации SOS:', err);
        }
      }, 
      (err) => {
        setError('Не удалось получить геолокацию');
        setSending(false);
        console.error('Ошибка геолокации:', err);
      }, 
      { 
        enableHighAccuracy: true, 
        timeout: 10000, 
        maximumAge: 0 
      }
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
      {error && (
        <div style={{ 
          color: 'white', 
          backgroundColor: '#dc3545', 
          padding: '0.75rem 1rem', 
          borderRadius: '0.25rem',
          width: '100%',
          maxWidth: '300px',
          textAlign: 'center'
        }}>
          {error}
        </div>
      )}
      
      <button
        onClick={handleSOS}
        style={{
          fontSize: '1.5rem',
          padding: '3rem',
          backgroundColor: sending ? '#999' : '#d32f2f',
          color: '#fff',
          border: 'none',
          borderRadius: '50%',
          cursor: sending ? 'not-allowed' : 'pointer',
          boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
          transition: 'all 0.3s ease'
        }}
      >
        {sending ? 'ОТМЕНА SOS' : 'SOS'}
      </button>
      
      {sending && (
        <div style={{ 
          padding: '1rem',
          backgroundColor: '#f8f9fa',
          borderRadius: '0.25rem',
          border: '1px solid #dee2e6',
          width: '100%',
          maxWidth: '300px',
          marginTop: '1rem'
        }}>
          <div style={{ 
            color: '#28a745', 
            fontWeight: 'bold', 
            marginBottom: '0.5rem',
            textAlign: 'center'
          }}>
            SOS сигнал отправлен
          </div>
          
          {location && (
            <div style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>
              <div><strong>Широта:</strong> {location.latitude.toFixed(6)}</div>
              <div><strong>Долгота:</strong> {location.longitude.toFixed(6)}</div>
            </div>
          )}
          
          <div style={{ 
            color: '#dc3545', 
            fontWeight: 'bold',
            marginBottom: '0.5rem',
            textAlign: 'center'
          }}>
            {backgroundMode ? 'Запись продолжается в фоновом режиме' : 'Идет запись с камеры'}
          </div>
          
          {debugMessage && (
            <div style={{ 
              fontSize: '0.8rem', 
              color: '#6c757d',
              textAlign: 'center',
              marginTop: '0.5rem'
            }}>
              {debugMessage}
            </div>
          )}
        </div>
      )}
      
      {streaming && !backgroundMode && (
        <div style={{ 
          width: '100%', 
          maxWidth: '300px',
          borderRadius: '0.25rem',
          overflow: 'hidden',
          border: '1px solid #dee2e6'
        }}>
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            style={{ 
              width: '100%',
              borderRadius: '0.25rem'
            }}
          />
        </div>
      )}
    </div>
  );
}
