// src/components/ModeratorDashboard/Dashboard.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { CallCard } from './CallCard';

export default function Dashboard() {
  const [calls, setCalls] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('jwtToken');
    // 1) Сначала загрузить текущие активные
    axios.get('/api/calls/active', { headers: { Authorization: `Bearer ${token}` } })
      .then(resp => setCalls(resp.data))
      .catch(console.error);

    // 2) Подключиться к сокету
    const socket = io('https://1fxpro.vip', {
      auth: { token },
      transports: ['websocket']
    });
    // присоединяемся к “модераторской” комнате
    socket.emit('join-room', 'moderators');

    // слушаем новые SOS
    socket.on('incoming-sos', sos => {
      setCalls(prev => [sos, ...prev]);
    });

    return () => socket.disconnect();
  }, []);

  const handleCancel = async id => {
    const token = localStorage.getItem('jwtToken');
    await axios.post(`/api/calls/${id}/cancel`, {}, { headers: { Authorization: `Bearer ${token}` } });
    setCalls(prev => prev.filter(c => c._id !== id));
  };

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ fontSize: 20, marginBottom: 16 }}>Активные SOS-вызовы</h2>
      {calls.length === 0 && <p>Нет активных сигналов</p>}
      {calls.map(call => (
        <CallCard key={call._id} call={call} onCancel={handleCancel} />
      ))}
      <h3 style={{ marginTop: 32 }}>История вызовов</h3>
<ul>
  {calls.map(c =>
    <li key={c._id}>
      {new Date(c.createdAt).toLocaleString()} — {c.phone} — {c.status}
    </li>
  )}
</ul>
    </div>
    
  );
}
