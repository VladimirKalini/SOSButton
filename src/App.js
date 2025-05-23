// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { SOSButton } from './components/SOSButton';
import { AuthProvider } from './authContext';
import { useAuth } from './authContext';
import Login from './components/Login';
import Register from './components/Register';

function ProtectedApp() {
  const { token, user } = useAuth();
  const phone = user?.phone || '';

  // Если нет токена — перенаправляем на логин
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>SOS Alert</h1>
      <SOSButton token={token} userPhone={phone} />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/*" element={<ProtectedApp />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
