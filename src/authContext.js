// src/authContext.js
import React, { createContext, useContext, useState, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Получение deviceId из localStorage или создание нового
  const getDeviceId = () => {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = uuidv4();
      localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
  };

  // Загрузка данных при инициализации
  useEffect(() => {
    const loadAuthData = async () => {
      try {
        setLoading(true);
        const savedToken = localStorage.getItem('jwtToken');
        const savedUser = localStorage.getItem('user');
        
        if (savedToken) {
          // Проверяем валидность токена и обновляем его
          try {
            const response = await axios.post('/api/refresh-token', { token: savedToken });
            const { token: newToken, user: userData } = response.data;
            
            setToken(newToken);
            setUser(userData);
            
            localStorage.setItem('jwtToken', newToken);
            localStorage.setItem('user', JSON.stringify(userData));
          } catch (error) {
            console.error('Ошибка при обновлении токена:', error);
            // Если токен недействителен, очищаем данные
            localStorage.removeItem('jwtToken');
            localStorage.removeItem('user');
          }
        } else if (savedUser) {
          try {
            setUser(JSON.parse(savedUser));
          } catch {
            localStorage.removeItem('user');
          }
        }
      } catch (error) {
        console.error('Ошибка при загрузке данных аутентификации:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAuthData();
  }, []);

  // Сохранение токена при изменении
  useEffect(() => {
    if (token) localStorage.setItem('jwtToken', token)
    else localStorage.removeItem('jwtToken')
  }, [token])

  // Сохранение данных пользователя при изменении
  useEffect(() => {
    if (user) localStorage.setItem('user', JSON.stringify(user))
    else localStorage.removeItem('user')
  }, [user])

  // Функция входа с поддержкой deviceId
  const login = async (phone, password) => {
    try {
      const deviceId = getDeviceId();
      const response = await axios.post('/api/login', { phone, password, deviceId });
      const { token: newToken, user: userData } = response.data;
      
      setToken(newToken);
      setUser(userData);
      
      // Обновляем deviceId, если он был изменен на сервере
      if (userData.deviceId && userData.deviceId !== deviceId) {
        localStorage.setItem('deviceId', userData.deviceId);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Ошибка при входе:', error);
      return { 
        success: false, 
        message: error.response?.data?.message || 'Ошибка при входе' 
      };
    }
  };

  // Функция выхода
  const logout = () => {
    setToken(null)
    setUser(null)
    // Не удаляем deviceId при выходе, чтобы сохранить привязку к устройству
  }

  return (
    <AuthContext.Provider value={{ 
      token, 
      user, 
      login, 
      logout, 
      loading,
      deviceId: user?.deviceId || getDeviceId()
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
