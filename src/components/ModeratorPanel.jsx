// src/components/ModeratorPanel.jsx
import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

export function ModeratorPanel({ token, serverUrl = 'https://1fxpro.vip' }) {
  const socketRef = useRef(null);
  const peersRef = useRef({});
  const [connections, setConnections] = useState([]);

  useEffect(() => {

    socketRef.current = io(serverUrl, {
      auth: { token },
      transports: ['websocket']
    });


    socketRef.current.emit('join-room', 'moderators');


    socketRef.current.on('incoming-sos', async ({ offer, latitude, longitude, phone, id }) => {
      const connId = id || uuidv4();

      const peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      peersRef.current[connId] = peer;

      peer.onicecandidate = ({ candidate }) => {
        if (candidate) {
          socketRef.current.emit('ice-candidate', { candidate, id: connId });
        }
      };

      peer.ontrack = ({ streams }) => {
        const remoteStream = streams[0];
        setConnections(prev => prev.map(c =>
          c.id === connId ? { ...c, stream: remoteStream } : c
        ));
      };

      setConnections(prev => [
        ...prev,
        { id: connId, phone, latitude, longitude, stream: null }
      ]);


      await peer.setRemoteDescription(offer);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      socketRef.current.emit('sos-answer', { answer, id: connId });
    });

    socketRef.current.on('ice-candidate', ({ candidate, id }) => {
      const peer = peersRef.current[id];
      if (peer) peer.addIceCandidate(candidate).catch(console.error);
    });

    return () => {
      socketRef.current.disconnect();
      Object.values(peersRef.current).forEach(p => p.close());
    };
  }, [serverUrl, token]);

  return (
    <div>
      <h2>Новые SOS-сигналы</h2>
      {connections.map(conn => (
        <div key={conn.id} style={{ marginBottom: '1.5rem' }}>
          <div>
            <strong>📞 {conn.phone}</strong><br />
            <em>📍 {conn.latitude.toFixed(5)}, {conn.longitude.toFixed(5)}</em>
          </div>
          {conn.stream ? (
            <video
              style={{ width: '100%', maxWidth: '400px', marginTop: '0.5rem' }}
              ref={videoEl => {
                if (videoEl && !videoEl.srcObject) {
                  videoEl.srcObject = conn.stream;
                }
              }}
              autoPlay
            />
          ) : (
            <p>Ожидание видео...</p>
          )}
        </div>
      ))}
    </div>
  );
}
