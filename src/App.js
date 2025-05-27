// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './authContext';
import LoginForm from './components/Login';
import Register from './components/Register';
import { SOSButton } from './components/SOSButton';
import GuardDashboard from './components/GuardDashboard';
import CallDetails from './components/CallDetails';

function UserApp() {
  const { token, user } = useAuth();
  const phone = user?.phone || '';

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>SOS Alert</h1>
      <SOSButton token={token} userPhone={phone} />
    </div>
  );
}

function GuardApp() {
  return (
    <div style={{ padding: '1rem' }}>
      <h1>Панель охраны</h1>
      <Routes>
        <Route path="/" element={<GuardDashboard />} />
        <Route path="/call/:id" element={<CallDetails />} />
      </Routes>
    </div>
  );
}

function ProtectedRoute() {
  const { token, user } = useAuth();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return user.role === 'guard' ? <GuardApp /> : <UserApp />;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginForm />} />
          <Route path="/register" element={<Register />} />
          <Route path="/*" element={<ProtectedRoute />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
