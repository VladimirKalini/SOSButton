// src/components/Register.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

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
  success: {
    color: '#38a169',
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
  inputFocus: {
    borderColor: '#3182ce',
    boxShadow: '0 0 0 2px rgba(49,130,206,0.5)',
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

export default function Register() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const validatePhone = (phone) => {
    return /^\+\d{11,15}$/.test(phone);
  };

  const handleRegister = async () => {
    setError('');
    setSuccess('');

    // Проверка телефона
    if (!validatePhone(phone)) {
      setError('Телефон должен быть в формате +79001234567');
      return;
    }

    // Проверка пароля
    if (password.length < 6) {
      setError('Пароль должен быть не менее 6 символов');
      return;
    }

    // Проверка совпадения паролей
    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    setLoading(true);
    try {
      await axios.post('/api/register', { phone, password });
      setSuccess('Регистрация успешна! Теперь вы можете войти.');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (e) {
      setError(
        e.response?.data?.message ||
        'Ошибка при регистрации. Попробуйте другой номер телефона.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = e => {
    e.preventDefault();
    if (!loading) handleRegister();
  };

  return (
    <div style={styles.page}>
      <form onSubmit={handleSubmit} style={styles.form}>
        <h2 style={styles.header}>Регистрация</h2>
        {error && <div style={styles.error}>{error}</div>}
        {success && <div style={styles.success}>{success}</div>}
        <div style={styles.field}>
          <label style={styles.label}>Телефон</label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+79001234567"
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
        <div style={styles.field}>
          <label style={styles.label}>Подтвердите пароль</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
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
          {loading ? 'Регистрация…' : 'Зарегистрироваться'}
        </button>
        <p style={styles.footer}>
          Уже есть аккаунт?{' '}
          <Link to="/login" style={styles.link}>
            Войти
          </Link>
        </p>
      </form>
    </div>
  );
}
