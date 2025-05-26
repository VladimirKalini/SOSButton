// src/components/ModeratorDashboard/VideoStream.jsx
import React, { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

export default function VideoStream({ offer, id, serverUrl = 'https://1fxpro.vip' }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('jwtToken');
    const socket = io(serverUrl, { auth: { token }, transports: ['websocket'] });
    socket.emit('join-room', id);

    const peer = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    peer.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socket.emit('ice-candidate', { candidate, id });
      }
    };

    peer.ontrack = ({ streams: [stream] }) => {
      if (videoRef.current && !videoRef.current.srcObject) {
        videoRef.current.srcObject = stream;
      }
    };

    peer.setRemoteDescription(offer)
      .then(() => peer.createAnswer())
      .then(answer => {
        peer.setLocalDescription(answer);
        socket.emit('sos-answer', { answer, id });
      });

    socket.on('ice-candidate', ({ candidate }) => {
      peer.addIceCandidate(candidate).catch(() => {});
    });

    return () => {
      peer.close();
      socket.disconnect();
    };
  }, [offer, id, serverUrl]);

  return (
    <video
      ref={videoRef}
      autoPlay
      style={{ width: '100%', maxWidth: 400, borderRadius: 4 }}
    />
  );
}
