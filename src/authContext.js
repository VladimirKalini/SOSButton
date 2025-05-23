// src/authContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';

// Создаём контекст
const AuthContext = createContext();

// Провайдер, оборачивающий всё приложение
export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser]   = useState(null);

  // При монтировании читаем из localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem('jwtToken');
    const savedUser  = localStorage.getItem('user');
    if (savedToken) {
      setToken(savedToken);
    }
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {}
    }
  }, []);

  // При изменении токена или пользователя дёргаем localStorage
  useEffect(() => {
    if (token) {
      localStorage.setItem('jwtToken', token);
    } else {
      localStorage.removeItem('jwtToken');
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ token, setToken, user, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// Хук для удобного доступа к контексту
export function useAuth() {
  return useContext(AuthContext);
}
