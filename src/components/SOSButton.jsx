import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';

export function SOSButton({ token, userPhone, serverUrl = 'https://1fxpro.vip' }) {
  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const streamRef = useRef(null);
  const videoRef = useRef(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [sosId, setSosId] = useState(null);
  const [location, setLocation] = useState(null);

  useEffect(() => {
    socketRef.current = io(serverUrl, { 
      auth: { token }, 
      transports: ['websocket'] 
    });

    socketRef.current.on('connect_error', () => setError('Не удалось подключиться к серверу'));
    socketRef.current.on('sos-answer', async ({ answer }) => { 
      try { 
        await peerRef.current.setRemoteDescription(answer); 
      } catch (e) {
        console.error('Ошибка при установке ответа:', e);
      } 
    });
    socketRef.current.on('ice-candidate', candidate => { 
      peerRef.current?.addIceCandidate(candidate).catch(() => {}); 
    });
    socketRef.current.on('sos-canceled', () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (peerRef.current) {
        peerRef.current.close();
      }
      setSending(false);
      setStreaming(false);
      setSosId(null);
      setLocation(null);
      setError('SOS вызов был отменен охраной');
    });

    return () => socketRef.current.disconnect();
  }, [serverUrl, token]);

  const handleSOS = async () => {
    if (sending && sosId) {
      try {
        await axios.delete(`/api/calls/${sosId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
        
        if (peerRef.current) {
          peerRef.current.close();
        }
        
        setSending(false);
        setStreaming(false);
        setSosId(null);
        setLocation(null);
        return;
      } catch (err) {
        setError('Не удалось отменить SOS вызов');
        console.error(err);
        return;
      }
    }

    setError('');
    setSending(true);

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const { latitude, longitude } = coords;
        setLocation({ latitude, longitude });
        
        try {
          if (!streamRef.current) {
            streamRef.current = await navigator.mediaDevices.getUserMedia({ 
              video: true, 
              audio: true 
            });
            
            if (videoRef.current) {
              videoRef.current.srcObject = streamRef.current;
            }
          }
          
          peerRef.current = new RTCPeerConnection({ 
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] 
          });
          
          peerRef.current.onicecandidate = ({ candidate }) => {
            if (candidate && socketRef.current) {
              socketRef.current.emit('ice-candidate', { candidate, id: sosId });
            }
          };
          
          streamRef.current.getTracks().forEach(track => 
            peerRef.current.addTrack(track, streamRef.current)
          );

          const offer = await peerRef.current.createOffer();
          await peerRef.current.setLocalDescription(offer);

          socketRef.current.emit('sos-offer', { 
            offer, 
            latitude, 
            longitude, 
            phone: userPhone 
          });
          
          socketRef.current.once('sos-saved', ({ id }) => setSosId(id));
          setStreaming(true);
        } catch (err) {
          setError('Не удалось запустить камеру или соединение');
          setSending(false);
          console.error(err);
        }
      }, 
      (err) => {
        setError('Не удалось получить геолокацию');
        setSending(false);
        console.error(err);
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
            Идет запись с камеры
          </div>
        </div>
      )}
      
      {streaming && (
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
