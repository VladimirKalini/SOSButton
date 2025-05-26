// src/components/ModeratorDashboard/CallCard.jsx
import React from 'react'
import { useAuth } from '../../authContext'
import VideoStream from './VideoStream'

export function CallCard({ call, onCancel }) {
  const { user } = useAuth()
  const canCancel = user.role === 'guard' || call.phone === user.phone

  return (
    <div style={{
      padding: '1rem',
      marginBottom: '1rem',
      border: '1px solid #ddd',
      borderRadius: '8px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      <div style={{ marginBottom: '0.5rem' }}>
        <strong>{call.phone}</strong>{' '}
        <em>{new Date(call.createdAt).toLocaleString()}</em>
      </div>
      <div style={{ marginBottom: '0.5rem' }}>
        📍 {call.latitude.toFixed(5)}, {call.longitude.toFixed(5)}
      </div>
      {canCancel && (
        <button onClick={() => onCancel(call._id)} style={{
          padding: '0.5rem 1rem',
          backgroundColor: '#d32f2f',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          marginBottom: '0.5rem'
        }}>
          Завершить
        </button>
      )}
      <VideoStream offer={call.offer} id={call._id} />
    </div>
  )
}
