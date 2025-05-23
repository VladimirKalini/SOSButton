// src/components/Register.jsx
import { useState } from 'react';
import axios from 'axios';

export function Register() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const register = async () => {
    await axios.post('/api/register', { phone, password });
    // затем редирект на /login или сразу логиним
  };
  return (
    <form onSubmit={e => { e.preventDefault(); register(); }}>
      <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Телефон" required />
      <input value={password} type="password" onChange={e => setPassword(e.target.value)} placeholder="Пароль" required />
      <button type="submit">Зарегистрироваться</button>
    </form>
  );
}
