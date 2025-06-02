import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { getPlatform } from './services/platformConfig';
import axios from 'axios';

// Устанавливаем базовый URL для axios
axios.defaults.baseURL = 'https://1fxpro.vip';

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
    } catch (err) {
      console.error('Ошибка регистрации SW:', err);
    }
  });
}

// 3) Отправляем метрики производительности
reportWebVitals();
