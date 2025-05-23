// src/components/SOSButton.jsx
import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

export function SOSButton({
  token,
  userPhone,
  serverUrl = 'https://1fxpro.vip' // ваш бэкенд+socket.io URL
}) {
  const socketRef = useRef(null);
  const peerRef   = useRef(null);
  const streamRef = useRef(null);
  const [sending, setSending] = useState(false);
  const [error, setError]     = useState('');
  const [streaming, setStreaming] = useState(false);

  // Инициализируем Socket.IO
  useEffect(() => {
    socketRef.current = io(serverUrl, {
      auth: { token },
      transports: ['websocket']
    });

    socketRef.current.on('connect_error', err => {
      console.error('Socket.IO connect_error:', err);
      setError('Не удалось подключиться к серверу');
    });

    // Когда модератор шлёт ответ с SDP-answer
    socketRef.current.on('sos-answer', async ({ answer }) => {
      try {
        await peerRef.current.setRemoteDescription(answer);
      } catch (e) {
        console.error('Ошибка установки remoteDescription:', e);
      }
    });

    // Ловим удалённые ICE-кандидаты от модератора
    socketRef.current.on('ice-candidate', candidate => {
      peerRef.current?.addIceCandidate(candidate).catch(e => {
        console.error('Ошибка добавления ICE-кандидата:', e);
      });
    });

    return () => {
      socketRef.current.disconnect();
    };
  }, [serverUrl, token]);

  const handleSOS = async () => {
    if (sending) return;
    setError('');
    setSending(true);

    // 1) Геопозиция
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      const { latitude, longitude } = coords;
      try {
        // 2) Получаем медиапоток (к камере/микрофону)
        if (!streamRef.current) {
          streamRef.current = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
          });
        }

        // 3) Создаём RTCPeerConnection с публичным STUN
        const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
        peerRef.current = new RTCPeerConnection({ iceServers });

        // Локальные кандидаты (посылаем модератору)
        peerRef.current.onicecandidate = ({ candidate }) => {
          if (candidate) {
            socketRef.current.emit('ice-candidate', candidate);
          }
        };

        // Когда получаем удалённый медиапоток (модератор ничего не шлёт обратно)
        peerRef.current.ontrack = ({ streams }) => {
          // Здесь можно привязать к видео-элементу, если нужен превью от модератора
          console.log('Получен удалённый трек:', streams);
        };

        // Добавляем все дорожки к Peer
        streamRef.current.getTracks().forEach(track =>
          peerRef.current.addTrack(track, streamRef.current)
        );

        // 4) Создаём offer и шлём его вместе с координатами и номером
        const offer = await peerRef.current.createOffer();
        await peerRef.current.setLocalDescription(offer);

        socketRef.current.emit('sos-offer', {
          offer,
          latitude,
          longitude,
          phone: userPhone
        });

        setStreaming(true);
      } catch (e) {
        console.error('Ошибка при инициализации стрима/WebRTC:', e);
        setError('Не удалось запустить камеру или соединение');
        setSending(false);
      }
    }, err => {
      console.error('Ошибка геопозиции:', err);
      setError('Не удалось получить геолокацию');
      setSending(false);
    }, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });
  };

  return (
    <div style={{ textAlign: 'center' }}>
      {error && (
        <div style={{ color: 'red', marginBottom: '0.5rem' }}>{error}</div>
      )}
      <button
        onClick={handleSOS}
        disabled={sending}
        style={{
          fontSize: '1.5rem',
          padding: '0.75rem 1.5rem',
          backgroundColor: sending ? '#999' : '#d32f2f',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: sending ? 'not-allowed' : 'pointer',
          marginBottom: streaming ? '1rem' : 0
        }}
      >
        {sending ? 'Отправка…' : 'SOS'}
      </button>

      {streaming && streamRef.current && (
        <video
          style={{ width: '250px', borderRadius: '4px' }}
          ref={videoEl => {
            if (videoEl && !videoEl.srcObject) {
              videoEl.srcObject = streamRef.current;
            }
          }}
          autoPlay
          muted
        />
      )}
    </div>
  );
}
