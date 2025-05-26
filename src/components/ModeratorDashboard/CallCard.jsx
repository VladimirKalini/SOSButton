// src/components/ModeratorDashboard/CallCard.jsx
import React from 'react'
import VideoStream from './VideoStream'

export function CallCard({ call, onCancel, userRole, userPhone }) {
  const canCancel = userRole === 'guard' || call.phone === userPhone

  return (
    <div style={{
      backgroundColor: '#fff',
      padding: '1rem',
      marginBottom: '1rem',
      borderRadius: 8,
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '0.5rem'
      }}>
        <span style={{ fontWeight: 600 }}>{call.phone}</span>
        <span style={{ color: '#666' }}>
          {new Date(call.createdAt).toLocaleString()}
        </span>
      </div>
      <div style={{
        fontSize: '0.9rem',
        color: '#333',
        marginBottom: '0.5rem'
      }}>
        📍 {call.latitude.toFixed(5)}, {call.longitude.toFixed(5)}
      </div>
      {canCancel && (
        <button
          onClick={() => onCancel(call._id)}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#d32f2f',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            marginBottom: '0.5rem'
          }}
        >
          Завершить
        </button>
      )}
      <VideoStream offer={call.offer} id={call._id} />
    </div>
  )
}
