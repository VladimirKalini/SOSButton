// src/components/Login.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../authContext';

export function LoginForm() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { setToken, setUser } = useAuth();

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const response = await axios.post('/api/login', { phone, password });
      const { token, user } = response.data;
      // Сохраняем в контексте и локальном хранилище
      setToken(token);
      setUser(user);
      localStorage.setItem('jwtToken', token);
      localStorage.setItem('user', JSON.stringify(user));
      // Редирект на главную страницу
      navigate('/');
    } catch (e) {
      setError(
        e.response?.data?.message ||
        'Ошибка при входе. Проверьте номер и пароль.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = e => {
    e.preventDefault();
    if (!loading) handleLogin();
  };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 320, margin: '0 auto', padding: '2rem' }}>
      <h2>Вход</h2>

      {error && (
        <div style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>
      )}

      <div style={{ marginBottom: '0.75rem' }}>
        <label>
          Телефон
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+7 (___) ___-__-__"
            required
            style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
          />
        </label>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label>
          Пароль
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Пароль"
            required
            style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={loading}
        style={{
          width: '100%',
          padding: '0.75rem',
          backgroundColor: loading ? '#ccc' : '#1976d2',
          color: '#fff',
          border: 'none',
          borderRadius: 4,
          cursor: loading ? 'not-allowed' : 'pointer'
        }}
      >
        {loading ? 'Вход…' : 'Войти'}
      </button>

      <p style={{ marginTop: '1rem', textAlign: 'center' }}>
        Нет аккаунта?{' '}
        <Link to="/register">Зарегистрироваться</Link>
      </p>
    </form>
  );
}
