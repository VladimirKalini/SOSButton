// src/components/ModeratorDashboard/Dashboard.jsx
import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { io } from 'socket.io-client'
import { useAuth } from '../../authContext'
import { CallCard } from './CallCard'

export default function Dashboard() {
  const { user } = useAuth()
  const [active, setActive]   = useState([])
  const [history, setHistory] = useState([])

  const loadData = async () => {
    const token = localStorage.getItem('jwtToken')
    const headers = { Authorization: `Bearer ${token}` }
    try {
      const [{ data: a }, { data: h }] = await Promise.all([
        axios.get('/api/calls/active',  { headers }),
        user.role === 'guard'
          ? axios.get('/api/calls/history', { headers })
          : Promise.resolve({ data: [] })
      ])
      setActive(a)
      setHistory(h)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadData()
    const token = localStorage.getItem('jwtToken')
    const socket = io('https://1fxpro.vip', {
      auth:      { token },
      transports:['websocket']
    })
    socket.emit('join-room', user.role === 'guard' ? 'moderators' : user.phone)
    socket.on('incoming-sos', sos => {
      const norm = {
        ...sos,
        _id: sos.id,
        status: 'active',
        createdAt: new Date().toISOString()
      }
      setActive(prev => [norm, ...prev])
      if (user.role === 'guard') {
        setHistory(prev => [norm, ...prev])
      }
    })
    return () => socket.disconnect()
  }, [user.role, user.phone])

  const handleCancel = async id => {
    const token = localStorage.getItem('jwtToken')
    try {
      await axios.post(`/api/calls/${id}/cancel`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setActive(a => a.filter(c => c._id !== id))
      setHistory(h => h.map(c =>
        c._id === id ? { ...c, status: 'cancelled' } : c
      ))
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div style={{
      maxWidth: 1200,
      margin: '0 auto',
      padding: '2rem'
    }}>
      <header style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: '2rem'
      }}>
        <h1 style={{ flex: 1, fontSize: '2rem', margin: 0 }}>
          Панель SOS
        </h1>
        <button
          onClick={loadData}
          style={{
            padding: '0.6rem 1.2rem',
            backgroundColor: '#1976d2',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer'
          }}
        >
          Обновить
        </button>
      </header>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '2rem'
      }}>
        <section>
          <h2 style={{ fontSize: '1.4rem', marginBottom: '1rem' }}>
            Активные вызовы
          </h2>
          {active.length === 0
            ? <p>Нет активных сигналов</p>
            : active.map(call => (
                <CallCard
                  key={call._id}
                  call={call}
                  onCancel={handleCancel}
                  userRole={user.role}
                  userPhone={user.phone}
                />
              ))
          }
        </section>

        {user.role === 'guard' && (
          <section>
            <h2 style={{ fontSize: '1.4rem', marginBottom: '1rem' }}>
              История вызовов
            </h2>
            {history.length === 0
              ? <p>Пока нет записей</p>
              : history.map(c => (
                  <div key={c._id} style={{
                    padding: '0.6rem',
                    marginBottom: '0.5rem',
                    borderRadius: 4,
                    backgroundColor: '#f5f5f5',
                    opacity: c.status === 'active' ? 1 : 0.6
                  }}>
                    <div>{new Date(c.createdAt).toLocaleString()}</div>
                    <div>{c.phone}</div>
                    <div><strong>{c.status}</strong></div>
                  </div>
                ))
            }
          </section>
        )}
      </div>
    </div>
  )
}
