// src/components/ModeratorDashboard/VideoStream.jsx
import React, { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

export default function VideoStream({ offer, id }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const socket = io('https://1fxpro.vip', {
      transports: ['websocket'],
      auth: { token: localStorage.getItem('jwtToken') }
    });

    const peer = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    socket.emit('join-room', id);

    peer.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socket.emit('ice-candidate', { candidate, id });
      }
    };

    peer.ontrack = ({ streams }) => {
      if (videoRef.current && !videoRef.current.srcObject) {
        videoRef.current.srcObject = streams[0];
      }
    };

    peer.setRemoteDescription(offer)
      .then(() => peer.createAnswer())
      .then(answer => peer.setLocalDescription(answer))
      .then(() => {
        socket.emit('sos-answer', { answer: peer.localDescription, id });
      });

    socket.on('ice-candidate', ({ candidate }) => {
      peer.addIceCandidate(candidate).catch(() => {});
    });

    return () => {
      peer.close();
      socket.disconnect();
    };
  }, [offer, id]);

  return (
    <video
      ref={videoRef}
      autoPlay
      style={{ width: '100%', maxWidth: 400, borderRadius: 4 }}
    />
  );
}
