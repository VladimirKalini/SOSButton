// src/components/Login.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../authContext';

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    padding: '16px',
    boxSizing: 'border-box',
  },
  form: {
    width: '100%',
    maxWidth: '400px',
    backgroundColor: '#ffffff',
    padding: '24px',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    boxSizing: 'border-box',
  },
  header: {
    fontSize: '24px',
    fontWeight: '700',
    marginBottom: '24px',
    textAlign: 'center',
  },
  error: {
    color: '#e53e3e',
    marginBottom: '16px',
    fontSize: '14px',
  },
  field: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    marginBottom: '4px',
    fontSize: '14px',
    fontWeight: '500',
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    fontSize: '14px',
    borderRadius: '6px',
    border: '1px solid #cbd5e0',
    outline: 'none',
    boxSizing: 'border-box',
  },
  button: {
    width: '100%',
    padding: '12px',
    fontSize: '16px',
    fontWeight: '600',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    backgroundColor: '#3182ce',
    marginTop: '8px',
  },
  buttonDisabled: {
    backgroundColor: '#a0aec0',
    cursor: 'not-allowed',
  },
  footer: {
    marginTop: '16px',
    textAlign: 'center',
    fontSize: '14px',
  },
  link: {
    color: '#3182ce',
    textDecoration: 'none',
  },
};
console.log('Axios baseURL:', axios.defaults.baseURL);
export default function LoginForm() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async () => {
    console.log('handleLogin called', { phone, password });

    setError('');
    setLoading(true);
    try {
      const { data } = await axios.post('/api/login', { phone, password });
      login(data.token, data.user);
      navigate('/', { replace: true });
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
    <div style={styles.page}>
      <form onSubmit={handleSubmit} style={styles.form}>
        <h2 style={styles.header}>Вход</h2>
        {error && <div style={styles.error}>{error}</div>}
        <div style={styles.field}>
          <label style={styles.label}>Телефон</label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            required
            style={styles.input}
          />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Пароль</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={styles.input}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          style={{
            ...styles.button,
            ...(loading ? styles.buttonDisabled : {}),
          }}
        >
          {loading ? 'Вход…' : 'Войти'}
        </button>
        <p style={styles.footer}>
          Нет аккаунта?{' '}
          <Link to="/register" style={styles.link}>
            Зарегистрироваться
          </Link>
        </p>
      </form>
    </div>
  );
}
