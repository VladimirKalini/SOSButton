// src/components/ModeratorDashboard/Dashboard.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { CallCard } from './CallCard';

export default function Dashboard() {
  const [calls, setCalls] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('jwtToken');

    // 1) Загрузить текущие активные SOS
    axios
      .get('/api/calls/active', {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(resp => setCalls(resp.data))
      .catch(console.error);

    // 2) Подписаться на новые через Socket.IO
    const socket = io('https://1fxpro.vip', {
      auth: { token },
      transports: ['websocket']
    });

    socket.emit('join-room', 'moderators');
    socket.on('incoming-sos', sos => {
      const normalized = {
        ...sos,
        _id: sos.id,
        status: 'active',
        createdAt: new Date().toISOString()
      };
      setCalls(prev => [normalized, ...prev]);
    });

    return () => socket.disconnect();
  }, []);

  // отмена SOS
  const handleCancel = async id => {
    const token = localStorage.getItem('jwtToken');
    try {
      await axios.post(
        `/api/calls/${id}/cancel`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCalls(prev => prev.filter(c => c._id !== id));
    } catch (err) {
      console.error('Cancel SOS error:', err);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ fontSize: 20, marginBottom: 16 }}>Активные SOS-вызовы</h2>
      {calls.length === 0 && <p>Нет активных сигналов</p>}
      {calls.map(call => (
        <CallCard key={call._id} call={call} onCancel={handleCancel} />
      ))}

      <h3 style={{ marginTop: 32, marginBottom: 8 }}>История вызовов</h3>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {calls.map(c => (
          <li
            key={c._id}
            style={{
              padding: '8px',
              borderBottom: '1px solid #eee',
              opacity: c.status === 'active' ? 1 : 0.6
            }}
          >
            {new Date(c.createdAt).toLocaleString()} — {c.phone} —{' '}
            <strong>{c.status}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
