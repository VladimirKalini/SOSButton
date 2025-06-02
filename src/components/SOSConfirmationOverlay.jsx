import React, { useEffect, useState } from 'react';
import { playSiren, stopSiren } from '../services/notificationService';

/**
 * Полноэкранное модальное окно для подтверждения SOS вызова
 * Показывается даже на заблокированном экране
 * 
 * @param {Object} props - Свойства компонента
 * @param {Object} props.callData - Данные о вызове
 * @param {Function} props.onAccept - Функция при принятии вызова
 * @param {Function} props.onDecline - Функция при отклонении вызова
 * @param {Function} props.onClose - Функция при закрытии оверлея
 * @param {boolean} props.show - Флаг видимости оверлея
 */
const SOSConfirmationOverlay = ({ callData = {}, onAccept, onDecline, onClose, show = false }) => {
  const [isVisible, setIsVisible] = useState(show);
  const [isSirenPlaying, setIsSirenPlaying] = useState(false);
  
  // Обработка видимости оверлея
  useEffect(() => {
    setIsVisible(show);
    
    // Запускаем сирену при показе оверлея
    if (show && !isSirenPlaying) {
      playSiren()
        .then(() => setIsSirenPlaying(true))
        .catch(err => console.error('Ошибка воспроизведения сирены:', err));
    }
    
    // Останавливаем сирену при скрытии оверлея
    if (!show && isSirenPlaying) {
      stopSiren();
      setIsSirenPlaying(false);
    }
    
    // Запрашиваем WakeLock при показе оверлея
    let wakeLock = null;
    if (show && 'wakeLock' in navigator) {
      navigator.wakeLock.request('screen')
        .then(lock => {
          wakeLock = lock;
          console.log('WakeLock получен');
        })
        .catch(err => console.error('Ошибка получения WakeLock:', err));
    }
    
    // Освобождаем WakeLock при скрытии оверлея
    return () => {
      if (wakeLock) {
        wakeLock.release()
          .then(() => console.log('WakeLock освобожден'))
          .catch(err => console.error('Ошибка освобождения WakeLock:', err));
      }
      
      if (isSirenPlaying) {
        stopSiren();
      }
    };
  }, [show, isSirenPlaying]);
  
  // Обработчики кнопок
  const handleAccept = () => {
    stopSiren();
    setIsSirenPlaying(false);
    if (onAccept) onAccept(callData);
    setIsVisible(false);
  };
  
  const handleDecline = () => {
    stopSiren();
    setIsSirenPlaying(false);
    if (onDecline) onDecline(callData);
    setIsVisible(false);
  };
  
  // Если оверлей не виден, не рендерим его
  if (!isVisible) return null;
  
  // Данные для отображения
  const displayName = callData.userName || 'Пользователь';
  const phoneNumber = callData.phone || 'Номер не указан';
  
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.95)',
      zIndex: 10000,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      color: 'white',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        backgroundColor: '#1a1a1a',
        borderRadius: '16px',
        padding: '24px',
        maxWidth: '90%',
        width: '400px',
        textAlign: 'center',
        boxShadow: '0 0 30px rgba(255, 59, 48, 0.5)'
      }}>
        <div style={{ 
          fontSize: 'clamp(24px, 8vw, 36px)', 
          fontWeight: 'bold', 
          marginBottom: '24px', 
          color: '#ff3b30',
          animation: 'pulse 1.5s infinite'
        }}>
          SOS ВЫЗОВ!
        </div>
        
        <div style={{ 
          fontSize: 'clamp(18px, 6vw, 24px)', 
          marginBottom: '16px',
          fontWeight: 'bold'
        }}>
          {displayName}
        </div>
        
        <div style={{ 
          fontSize: 'clamp(16px, 5vw, 20px)', 
          marginBottom: '32px',
          opacity: 0.8
        }}>
          {phoneNumber}
        </div>
        
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '16px'
        }}>
          <button 
            onClick={handleAccept}
            style={{
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '50px',
              padding: '16px',
              fontSize: 'clamp(16px, 5vw, 20px)',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px'
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
              <path d="M0 5a2 2 0 0 1 2-2h7.5a2 2 0 0 1 1.983 1.738l3.11-1.382A1 1 0 0 1 16 4.269v7.462a1 1 0 0 1-1.406.913l-3.111-1.382A2 2 0 0 1 9.5 13H2a2 2 0 0 1-2-2V5z"/>
            </svg>
            Принять вызов
          </button>
          
          <button 
            onClick={handleDecline}
            style={{
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '50px',
              padding: '16px',
              fontSize: 'clamp(16px, 5vw, 20px)',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px'
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
              <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
              <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
            </svg>
            Отклонить вызов
          </button>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.9; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default SOSConfirmationOverlay; 