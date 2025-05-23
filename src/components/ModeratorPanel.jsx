// src/components/ModeratorPanel.jsx
import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

export function ModeratorPanel({ token }) {
  const socket = io({ auth: { token } });
  const videoRef = useRef();
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    socket.emit('join-room', 'moderators');
    socket.on('incoming-sos', async ({ offer, latitude, longitude, phone }) => {
      setAlerts(a => [...a, { phone, latitude, longitude }]);
      const peer = new RTCPeerConnection(/* конфиг SFU */);
      peer.ontrack = e => { videoRef.current.srcObject = e.streams[0]; };
      peer.onicecandidate = e => e.candidate && socket.emit('ice-candidate', e.candidate);
      await peer.setRemoteDescription(offer);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit('sos-answer', { answer });
    });
    socket.on('ice-candidate', candidate => peer.addIceCandidate(candidate));
  }, []);

  return (
    <div>
      <h2>Новые сигналы SOS:</h2>
      <ul>
        {alerts.map((a,i) =>
          <li key={i}>
            📞 {a.phone}, 📍{a.latitude.toFixed(5)}, {a.longitude.toFixed(5)}
          </li>
        )}
      </ul>
      <video ref={videoRef} autoPlay style={{width: '100%'}}></video>
    </div>
  );
}
