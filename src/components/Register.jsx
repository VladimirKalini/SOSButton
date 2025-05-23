// src/components/Register.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function Register() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const register = async () => {
    setError('');
    setLoading(true);
    try {
      await axios.post('/api/register', { phone, password });
      // после успешной регистрации перенаправляем на страницу входа
      navigate('/login');
    } catch (e) {
      // показываем сообщение ошибки из ответа сервера или общее
      setError(
        e.response?.data?.message ||
        'Ошибка при регистрации. Попробуйте ещё раз.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = e => {
    e.preventDefault();
    if (!loading) register();
  };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 320, margin: '0 auto' }}>
      <h2>Регистрация</h2>

      {error && (
        <div style={{ color: 'red', marginBottom: '1rem' }}>
          {error}
        </div>
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
            placeholder="Минимум 6 символов"
            required
            style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
            minLength={6}
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
        {loading ? 'Регистрация…' : 'Зарегистрироваться'}
      </button>
    </form>
  );
}
export default Register;