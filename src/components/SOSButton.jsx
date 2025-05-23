// src/components/SOSButton.jsx
import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

export function SOSButton({ token, userPhone }) {
  const socketRef = useRef(null);
  const peerRef   = useRef(null);
  const streamRef = useRef(null);
  const [sending, setSending] = useState(false);

  // 1. Инициализируем socket при монтировании
  useEffect(() => {
    socketRef.current = io('https://домен', {
      auth: { token },
      transports: ['websocket']
    });

    socketRef.current.on('connect_error', err => {
      console.error('Socket.IO connect_error:', err);
    });

    // :: Можно добавить обработчики ответов модератора, ошибок и т.п.

    return () => {
      // Очистка при размонтировании
      socketRef.current.disconnect();
    };
  }, [token]);

  const handleSOS = async () => {
    if (sending) return;  // защиты от повторного нажатия
    setSending(true);

    // 2. Запрос геопозиции
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      const { latitude, longitude } = coords;
      try {
        // 3. Запрашиваем стрим, если ещё не запрашивали
        if (!streamRef.current) {
          streamRef.current = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
          });
        }

        // 4. Настраиваем RTCPeerConnection
        const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
        peerRef.current = new RTCPeerConnection({ iceServers });

        // Отправка локальных ICE-кандидатов на сервер
        peerRef.current.onicecandidate = ({ candidate }) => {
          if (candidate) {
            socketRef.current.emit('ice-candidate', candidate);
          }
        };

        // Добавляем видеодорожки
        streamRef.current.getTracks().forEach(track =>
          peerRef.current.addTrack(track, streamRef.current)
        );

        // 5. Генерируем SDP-offer и шлём модератору вместе с данными
        const offer = await peerRef.current.createOffer();
        await peerRef.current.setLocalDescription(offer);

        socketRef.current.emit('sos-offer', {
          offer,
          latitude,
          longitude,
          phone: userPhone
        });
      } catch (err) {
        console.error('Ошибка при получении медиа или создании peer:', err);
      }
    }, error => {
      console.error('Не удалось получить геопозицию:', error);
    }, {
      enableHighAccuracy: true,
      timeout: 10_000,
      maximumAge: 0
    });
  };

  return (
    <button
      onClick={handleSOS}
      disabled={sending}
      style={{
        fontSize: '2rem',
        padding: '1rem',
        backgroundColor: sending ? '#ccc' : '#d32f2f',
        color: '#fff',
        border: 'none',
        borderRadius: '8px',
        cursor: sending ? 'not-allowed' : 'pointer'
      }}
    >
      {sending ? 'Отправка…' : 'SOS'}
    </button>
  );
}
