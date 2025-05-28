import React, { useState, useEffect } from 'react';

// Компонент для запроса разрешений на доступ к камере, микрофону и геолокации
const PermissionsRequest = ({ onPermissionsGranted }) => {
  const [cameraPermission, setCameraPermission] = useState('pending');
  const [microphonePermission, setMicrophonePermission] = useState('pending');
  const [locationPermission, setLocationPermission] = useState('pending');
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Определяем, запущено ли приложение на iOS
    const iosCheck = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(iosCheck);
    
    if (iosCheck) {
      console.log('Обнаружена iOS платформа, требуются явные разрешения');
    }
  }, []);

  // Запрос разрешения на доступ к камере
  const requestCameraPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraPermission('granted');
      
      // Останавливаем потоки после получения разрешения
      stream.getTracks().forEach(track => track.stop());
      
      console.log('Разрешение на доступ к камере получено');
      return true;
    } catch (error) {
      console.error('Ошибка при запросе разрешения на камеру:', error);
      setCameraPermission('denied');
      return false;
    }
  };

  // Запрос разрешения на доступ к микрофону
  const requestMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicrophonePermission('granted');
      
      // Останавливаем потоки после получения разрешения
      stream.getTracks().forEach(track => track.stop());
      
      console.log('Разрешение на доступ к микрофону получено');
      return true;
    } catch (error) {
      console.error('Ошибка при запросе разрешения на микрофон:', error);
      setMicrophonePermission('denied');
      return false;
    }
  };

  // Запрос разрешения на доступ к геолокации
  const requestLocationPermission = async () => {
    try {
      await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          position => {
            console.log('Разрешение на доступ к геолокации получено');
            resolve(position);
          },
          error => {
            console.error('Ошибка при запросе разрешения на геолокацию:', error);
            reject(error);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      });
      
      setLocationPermission('granted');
      return true;
    } catch (error) {
      setLocationPermission('denied');
      return false;
    }
  };

  // Запрос всех разрешений сразу
  const requestAllPermissions = async () => {
    const cameraGranted = await requestCameraPermission();
    const microphoneGranted = await requestMicrophonePermission();
    const locationGranted = await requestLocationPermission();
    
    if (cameraGranted && microphoneGranted && locationGranted) {
      if (onPermissionsGranted) {
        onPermissionsGranted();
      }
    }
  };

  // Если не iOS, сразу вызываем колбэк
  useEffect(() => {
    if (!isIOS && onPermissionsGranted) {
      onPermissionsGranted();
    }
  }, [isIOS, onPermissionsGranted]);

  // Если не iOS, не отображаем компонент
  if (!isIOS) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 9999,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '90%',
        width: '350px',
        textAlign: 'center'
      }}>
        <h2 style={{ margin: '0 0 16px', color: '#333' }}>Необходимы разрешения</h2>
        <p style={{ marginBottom: '24px', color: '#666', fontSize: '16px' }}>
          Для работы приложения требуется доступ к камере, микрофону и геолокации.
        </p>
        
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ 
              width: '12px', 
              height: '12px', 
              borderRadius: '50%', 
              backgroundColor: cameraPermission === 'granted' ? '#4caf50' : '#ff9800',
              display: 'inline-block',
              marginRight: '8px'
            }}></span>
            <span>Камера: {cameraPermission === 'granted' ? 'Разрешено' : 'Ожидание'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ 
              width: '12px', 
              height: '12px', 
              borderRadius: '50%', 
              backgroundColor: microphonePermission === 'granted' ? '#4caf50' : '#ff9800',
              display: 'inline-block',
              marginRight: '8px'
            }}></span>
            <span>Микрофон: {microphonePermission === 'granted' ? 'Разрешено' : 'Ожидание'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ 
              width: '12px', 
              height: '12px', 
              borderRadius: '50%', 
              backgroundColor: locationPermission === 'granted' ? '#4caf50' : '#ff9800',
              display: 'inline-block',
              marginRight: '8px'
            }}></span>
            <span>Геолокация: {locationPermission === 'granted' ? 'Разрешено' : 'Ожидание'}</span>
          </div>
        </div>
        
        <button 
          onClick={requestAllPermissions}
          style={{
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            padding: '12px 24px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            width: '100%'
          }}
        >
          Разрешить доступ
        </button>
      </div>
    </div>
  );
};

export default PermissionsRequest; 