// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './authContext';
import LoginForm from './components/Login';
import Register from './components/Register';
import { SOSButton } from './components/SOSButton';
import GuardDashboard from './components/GuardDashboard';
import CallDetails from './components/CallDetails';
import './App.css';

// Добавляем стили для адаптивной верстки
const responsiveStyles = {
  container: {
    padding: '1rem',
    maxWidth: '1200px',
    margin: '0 auto',
    boxSizing: 'border-box',
    width: '100%'
  },
  userApp: {
    padding: '1rem',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh'
  },
  guardApp: {
    padding: '1rem',
    boxSizing: 'border-box',
    width: '100%'
  },
  heading: {
    fontSize: 'clamp(1.5rem, 5vw, 2.5rem)',
    marginBottom: '1.5rem',
    textAlign: 'center'
  }
};

function UserApp() {
  const { token, user } = useAuth();
  const phone = user?.phone || '';

  return (
    <div style={responsiveStyles.userApp}>
      <h1 style={responsiveStyles.heading}>SOS Alert</h1>
      <SOSButton token={token} userPhone={phone} />
    </div>
  );
}

function GuardApp() {
  return (
    <div style={responsiveStyles.guardApp}>
      <h1 style={responsiveStyles.heading}>Панель охраны</h1>
      <div style={responsiveStyles.container}>
        <Routes>
          <Route path="/" element={<GuardDashboard />} />
          <Route path="/call/:id" element={<CallDetails />} />
        </Routes>
      </div>
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
