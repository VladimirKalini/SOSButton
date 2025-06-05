import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { getPlatform } from './services/platformConfig';
import axios from 'axios';

// Устанавливаем базовый URL для axios
axios.defaults.baseURL = 'https://novyy-gorizont-sos.com';

// 1) Рендерим React-приложение
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// 2) Регистрируем сервис-воркер для поддержки оффлайн-режима и уведомлений
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      // Определяем платформу для специфичных настроек
      const platform = getPlatform();
      console.log(`Платформа: ${platform}`);
      
      // Регистрируем сервис-воркер с опцией updateViaCache: 'none' для принудительного обновления
      const registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/',
        updateViaCache: 'none'
      });
      console.log('Service Worker зарегистрирован:', registration);
      
      // Принудительно обновляем service worker, если он уже установлен
      if (registration.waiting) {
        console.log('Найден ожидающий service worker, активируем его');
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      
      // Запрашиваем разрешение на показ уведомлений
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        console.log(`Разрешение на уведомления: ${permission}`);
        
        // Если разрешение получено, подписываемся на push-уведомления
        if (permission === 'granted' && 'PushManager' in window) {
          try {
            // Проверяем наличие существующей подписки
            let subscription = await registration.pushManager.getSubscription();
            
            if (!subscription) {
              // Создаем новую подписку
              const publicVapidKey = 'BLBz4TFiSfAM9qfyX3GJQrHXqUAzTVJ6UQzADDw_wXJYdqi_Z3X6eRLTZuNnTwAZrUU7hjHyRwrNfwOxGwODnxA';
              
              // Преобразуем VAPID ключ для использования в подписке
              const applicationServerKey = urlBase64ToUint8Array(publicVapidKey);
              
              // Создаем подписку с явным указанием userVisibleOnly: true
              subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: applicationServerKey
              });
              
              console.log('Создана новая push-подписка:', subscription);
              
              // Отправляем подписку на сервер для сохранения
              const role = localStorage.getItem('userRole') || 'user';
              try {
                const response = await axios.post('/api/save-subscription', { 
                  subscription, 
                  role 
                });
                console.log('Подписка отправлена на сервер:', response.data);
              } catch (serverErr) {
                console.error('Ошибка отправки подписки на сервер:', serverErr);
                // Повторная попытка отправки через 5 секунд
                setTimeout(async () => {
                  try {
                    const retryResponse = await axios.post('/api/save-subscription', { 
                      subscription, 
                      role 
                    });
                    console.log('Повторная отправка подписки успешна:', retryResponse.data);
                  } catch (retryErr) {
                    console.error('Повторная отправка подписки не удалась:', retryErr);
                  }
                }, 5000);
              }
            } else {
              console.log('Используется существующая push-подписка:', subscription);
              
              // Обновляем подписку на сервере
              const role = localStorage.getItem('userRole') || 'user';
              try {
                const response = await axios.post('/api/save-subscription', { 
                  subscription, 
                  role 
                });
                console.log('Существующая подписка обновлена на сервере:', response.data);
              } catch (serverErr) {
                console.error('Ошибка обновления подписки на сервере:', serverErr);
                
                // Если ошибка, пробуем пересоздать подписку
                if (platform === 'android' || platform === 'ios') {
                  console.log('Пробуем пересоздать подписку для мобильного устройства');
                  try {
                    // Отменяем текущую подписку
                    await subscription.unsubscribe();
                    console.log('Старая подписка отменена');
                    
                    // Создаем новую подписку
                    const publicVapidKey = 'BLBz4TFiSfAM9qfyX3GJQrHXqUAzTVJ6UQzADDw_wXJYdqi_Z3X6eRLTZuNnTwAZrUU7hjHyRwrNfwOxGwODnxA';
                    const newSubscription = await registration.pushManager.subscribe({
                      userVisibleOnly: true,
                      applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
                    });
                    
                    console.log('Пересоздана push-подписка:', newSubscription);
                    
                    // Отправляем новую подписку на сервер
                    const newResponse = await axios.post('/api/save-subscription', { 
                      subscription: newSubscription, 
                      role 
                    });
                    console.log('Новая подписка отправлена на сервер:', newResponse.data);
                  } catch (recreateErr) {
                    console.error('Ошибка пересоздания подписки:', recreateErr);
                  }
                }
              }
            }
          } catch (err) {
            console.error('Ошибка подписки на push-уведомления:', err);
          }
        }
      }
      
      // Настраиваем канал уведомлений для Android
      if (platform === 'android' && 'PushManager' in window) {
        // Для современных браузеров с поддержкой каналов уведомлений
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'INIT_NOTIFICATION_CHANNEL',
            channel: {
              id: 'sos_channel',
              name: 'SOS Уведомления',
              description: 'Важные уведомления о SOS-вызовах',
              importance: 'high',
              // Добавляем настройки для полноэкранных уведомлений
              enableVibration: true,
              vibrationPattern: [200, 100, 200, 100, 200, 100, 400],
              enableLights: true,
              lightColor: '#ff0000',
              lockscreenVisibility: 'public',
              fullScreenIntent: true
            }
          });
        }
      }
      
      // Отправляем тестовое уведомление для проверки
      setTimeout(() => {
        if (registration.active) {
          registration.active.postMessage({
            action: 'send-test-notification',
            platform: platform
          });
        }
      }, 5000);
    } catch (err) {
      console.error('Ошибка регистрации SW:', err);
    }
  });
}

// Функция для конвертации base64 в Uint8Array (для applicationServerKey)
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// 3) Отправляем метрики производительности
reportWebVitals();
