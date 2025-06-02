import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Компонент для запроса разрешений на доступ к камере, микрофону и геолокации
const PermissionsRequest = () => {
  const [permissions, setPermissions] = useState({
    location: false
  });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Проверяем, является ли устройство iOS
  const iosCheck = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  useEffect(() => {
    // Проверяем наличие разрешений при загрузке компонента
    checkPermissions();
  }, []);

  // Функция для проверки разрешений
  const checkPermissions = async () => {
    try {
      // Проверяем разрешение на геолокацию
      const locationPermission = await checkLocationPermission();
      setPermissions(prev => ({ ...prev, location: locationPermission }));
      
      // Если все разрешения получены, переходим к авторизации
      if (locationPermission) {
        navigate('/login');
      }
    } catch (err) {
      console.error('Ошибка при проверке разрешений:', err);
      setError('Не удалось проверить разрешения приложения');
    }
  };

  // Проверка разрешения на геолокацию
  const checkLocationPermission = () => {
    return new Promise((resolve) => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          () => resolve(true),
          () => resolve(false),
          { timeout: 10000 }
        );
      } else {
        resolve(false);
      }
    });
  };

  // Запрашиваем разрешения
  const requestPermissions = async () => {
    try {
      // Запрашиваем геолокацию
      if (!permissions.location) {
        const locationGranted = await checkLocationPermission();
        setPermissions(prev => ({ ...prev, location: locationGranted }));
      }
      
      // Если все разрешения получены, переходим к авторизации
      if (permissions.location) {
        navigate('/login');
      }
    } catch (err) {
      console.error('Ошибка при запросе разрешений:', err);
      setError('Не удалось запросить необходимые разрешения');
    }
  };

  return (
    <div style={{ 
      padding: '20px',
      maxWidth: '600px',
      margin: '0 auto',
      textAlign: 'center'
    }}>
      <h1>Необходимые разрешения</h1>
      
      <p>
        Для работы приложения требуется доступ к вашей геолокации.
        Это необходимо для отправки координат при экстренном вызове.
      </p>
      
      {error && (
        <div style={{
          backgroundColor: '#f8d7da',
          color: '#721c24',
          padding: '10px',
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          {error}
        </div>
      )}
      
      <div style={{
        backgroundColor: '#f8f9fa',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <h3>Статус разрешений:</h3>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          marginTop: '15px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span>Геолокация</span>
            <span style={{
              backgroundColor: permissions.location ? '#d4edda' : '#f8d7da',
              color: permissions.location ? '#155724' : '#721c24',
              padding: '5px 10px',
              borderRadius: '4px'
            }}>
              {permissions.location ? 'Разрешено' : 'Не разрешено'}
            </span>
          </div>
        </div>
      </div>
      
      <button
        onClick={requestPermissions}
        style={{
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          padding: '12px 24px',
          fontSize: '16px',
          cursor: 'pointer'
        }}
      >
        {permissions.location ? 'Продолжить' : 'Запросить разрешения'}
      </button>
      
      {iosCheck && (
        <div style={{
          marginTop: '20px',
          padding: '15px',
          backgroundColor: '#fff3cd',
          color: '#856404',
          borderRadius: '4px'
        }}>
          <strong>Внимание!</strong> На устройствах iOS для корректной работы приложения необходимо
          разрешить доступ к геолокации в настройках Safari.
        </div>
      )}
    </div>
  );
};

export default PermissionsRequest; 