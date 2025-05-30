import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { getPlatform } from './services/platformConfig';

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
      
      // Регистрируем сервис-воркер
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker зарегистрирован:', registration);
      
      // Запрашиваем разрешение на показ уведомлений
      if ('Notification' in window && Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission();
        console.log(`Разрешение на уведомления: ${permission}`);
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
              importance: 'high'
            }
          });
        }
      }
    } catch (err) {
      console.error('Ошибка регистрации SW:', err);
    }
  });
}

// 3) Отправляем метрики производительности
reportWebVitals();
