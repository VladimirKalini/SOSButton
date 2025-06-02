import React from 'react';

export default function VideoStream({ offer, id, serverUrl = 'https://1fxpro.vip' }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f8f9fa',
      border: '1px solid #dee2e6',
      borderRadius: '8px',
      padding: '20px',
      height: '300px',
      width: '100%'
    }}>
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="64" 
        height="64" 
        fill="#6c757d" 
        viewBox="0 0 16 16"
        style={{ marginBottom: '20px' }}
      >
        <path d="M6.79 5.093A.5.5 0 0 0 6 5.5v5a.5.5 0 0 0 .79.407l3.5-2.5a.5.5 0 0 0 0-.814l-3.5-2.5z"/>
        <path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4zm15 0a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4z"/>
      </svg>
      <h3 style={{ 
        margin: '0 0 10px 0',
        color: '#343a40',
        textAlign: 'center'
      }}>
        Видеотрансляция отключена
      </h3>
      <p style={{ 
        margin: '0',
        color: '#6c757d',
        textAlign: 'center'
      }}>
        Функция прямой видеотрансляции была отключена в этой версии приложения.
        Используйте телефонную связь для коммуникации.
      </p>
    </div>
  );
}
