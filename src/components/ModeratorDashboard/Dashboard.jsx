// src/components/ModeratorDashboard/Dashboard.jsx
import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { io } from 'socket.io-client'
import { useAuth } from '../../authContext'
import { CallCard } from './CallCard'

export default function Dashboard() {
  const { user, logout } = useAuth()
  const [active, setActive]   = useState([])
  const [history, setHistory] = useState([])

  // при смене user реинициализируем всё
  useEffect(() => {
    if (!user) return

    setActive([])
    setHistory([])

    const token = localStorage.getItem('jwtToken')
    const headers = { Authorization: `Bearer ${token}` }

    axios.get('/api/calls/active', { headers })
      .then(r => setActive(r.data))
      .catch(err => {
        if (err.response?.status === 401) logout()
      })

    if (user.role === 'guard') {
      axios.get('/api/calls/history', { headers })
        .then(r => setHistory(r.data))
        .catch(err => {
          if (err.response?.status === 401) logout()
        })
    }

    const socket = io('https://1fxpro.vip', { auth: { token }, transports: ['websocket'] })
    socket.emit('join-room', user.role === 'guard' ? 'moderators' : user.phone)

    socket.on('incoming-sos', sos => {
      const normalized = {
        ...sos,
        _id: sos.id,
        status: 'active',
        createdAt: new Date().toISOString()
      }
      setActive(prev => [normalized, ...prev])
      if (user.role === 'guard') {
        setHistory(prev => [normalized, ...prev])
      }
    })

    return () => socket.disconnect()
  }, [user, logout])

  const handleCancel = async id => {
    const token = localStorage.getItem('jwtToken')
    try {
      await axios.post(`/api/calls/${id}/cancel}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setActive(a => a.filter(c => c._id !== id))
      setHistory(h => h.map(c => c._id === id ? { ...c, status: 'cancelled' } : c))
    } catch (err) {
      if (err.response?.status === 403) {
        alert('У вас нет прав для этого действия')
      } else if (err.response?.status === 401) {
        logout()
      } else {
        console.error(err)
      }
    }
  }

  if (!user) return null

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1>Панель SOS</h1>
        <button onClick={logout} style={{ background: '#e53e3e', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: 4, cursor: 'pointer' }}>
          Выйти
        </button>
      </header>

      <button onClick={() => { /* ручная перезагрузка */ }} style={{ marginBottom: 16 }}>
        Обновить
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <section>
          <h2>Активные вызовы</h2>
          {active.length === 0 ? (
            <p>Нет активных сигналов</p>
          ) : (
            active.map(call =>
              <CallCard key={call._id} call={call} onCancel={handleCancel} userRole={user.role} userPhone={user.phone} />
            )
          )}
        </section>
        {user.role === 'guard' && (
          <section>
            <h2>История вызовов</h2>
            {history.length === 0 ? (
              <p>Пока нет записей</p>
            ) : (
              history.map(c =>
                <div key={c._id} style={{ padding: 8, borderRadius: 4, background: '#f5f5f5', marginBottom: 8, opacity: c.status === 'active' ? 1 : 0.6 }}>
                  <div>{new Date(c.createdAt).toLocaleString()}</div>
                  <div>{c.phone}</div>
                  <div><strong>{c.status}</strong></div>
                </div>
              )
            )}
          </section>
        )}
      </div>
    </div>
  )
}
