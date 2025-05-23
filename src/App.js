// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './authContext';
import LoginForm from './components/Login';
import Register from './components/Register';
import { SOSButton } from './components/SOSButton';
import { ModeratorPanel } from './components/ModeratorPanel';

function ProtectedApp() {
  const { token, user } = useAuth();
  const phone = user?.phone || '';

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>SOS Alert</h1>
      <SOSButton token={token} userPhone={phone} />
      <ModeratorPanel token={token} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginForm />} />
          <Route path="/register" element={<Register />} />
          <Route path="/*" element={<ProtectedApp />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
