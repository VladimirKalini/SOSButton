import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';

export function SOSButton({ token, userPhone, serverUrl = 'https://1fxpro.vip' }) {
  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const streamRef = useRef(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [sosId, setSosId] = useState(null);

  useEffect(() => {
    socketRef.current = io(serverUrl, { auth: { token }, transports: ['websocket'] });

    socketRef.current.on('connect_error', () => setError('Не удалось подключиться к серверу'));
    socketRef.current.on('sos-answer', async ({ answer }) => { try { await peerRef.current.setRemoteDescription(answer); } catch {} });
    socketRef.current.on('ice-candidate', candidate => { peerRef.current?.addIceCandidate(candidate).catch(() => {}); });

    return () => socketRef.current.disconnect();
  }, [serverUrl, token]);

  const handleSOS = async () => {
    if (sending && sosId) {
      await axios.post(`/api/calls/${sosId}/cancel`, {}, { headers: { Authorization: `Bearer ${token}` } });
      streamRef.current.getTracks().forEach(track => track.stop());
      peerRef.current.close();
      setSending(false);
      setStreaming(false);
      setSosId(null);
      return;
    }
    setError('');
    setSending(true);

    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      const { latitude, longitude } = coords;
      try {
        if (!streamRef.current) {
          streamRef.current = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        }
        peerRef.current = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        peerRef.current.onicecandidate = ({ candidate }) => {
          if (candidate) {
            socketRef.current.emit('ice-candidate', { candidate, id: sosId });
          }
        };
        streamRef.current.getTracks().forEach(track => peerRef.current.addTrack(track, streamRef.current));

        const offer = await peerRef.current.createOffer();
        await peerRef.current.setLocalDescription(offer);

        socketRef.current.emit('sos-offer', { offer, latitude, longitude, phone: userPhone });
        socketRef.current.once('sos-saved', ({ id }) => setSosId(id));

        setStreaming(true);
      } catch {
        setError('Не удалось запустить камеру или соединение');
        setSending(false);
      }
    }, () => {
      setError('Не удалось получить геолокацию');
      setSending(false);
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
  };

  return (
    <div style={{ textAlign: 'center' }}>
      {error && <div style={{ color: 'red', marginBottom: '0.5rem' }}>{error}</div>}
      <button
        onClick={handleSOS}
        disabled={sending}
        style={{
          fontSize: '1.5rem',
          padding: '3rem',
          backgroundColor: sending ? '#999' : '#d32f2f',
          color: '#fff',
          border: 'none',
          borderRadius: '50%',
          cursor: sending ? 'not-allowed' : 'pointer',
          marginBottom: streaming ? '1rem' : 0
        }}
      >
        {sending ? 'Отправка…' : 'SOS'}
      </button>
      {streaming && streamRef.current && (
        <video
          style={{ width: '250px', borderRadius: '4px' }}
          ref={videoEl => { if (videoEl && !videoEl.srcObject) { videoEl.srcObject = streamRef.current; } }}
          autoPlay
          muted
        />
      )}
    </div>
  );
}
