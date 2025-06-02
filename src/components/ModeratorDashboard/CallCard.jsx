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
      <div style={{ 
        display: 'flex', 
        gap: '10px', 
        marginBottom: '1rem' 
      }}>
        {canCancel && (
          <button
            onClick={() => onCancel(call._id)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#d32f2f',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer'
            }}
          >
            Завершить
          </button>
        )}
        <a
          href={`tel:${call.phone}`}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#2196f3',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center'
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style={{ marginRight: '5px' }}>
            <path d="M11 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h6zM5 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H5z"/>
            <path d="M8 14a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/>
          </svg>
          Позвонить
        </a>
        <a
          href={`https://www.google.com/maps?q=${call.latitude},${call.longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#4caf50',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center'
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style={{ marginRight: '5px' }}>
            <path d="M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10zm0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/>
          </svg>
          Карта
        </a>
      </div>
      <VideoStream offer={call.offer} id={call._id} />
    </div>
  )
}
