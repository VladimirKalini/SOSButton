// src/components/ModeratorDashboard/Dashboard.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { CallCard } from './CallCard';

export default function Dashboard() {
  const [calls, setCalls] = useState([]);

  useEffect(() => {
    fetchActive();
  }, []);

  const fetchActive = async () => {
    const token = localStorage.getItem('jwtToken');
    const response = await axios.get('/api/calls/active', {
      headers: { Authorization: `Bearer ${token}` }
    });
    setCalls(response.data);
  };

  const handleCancel = async id => {
    const token = localStorage.getItem('jwtToken');
    await axios.post(
      `/api/calls/${id}/cancel`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    setCalls(prev => prev.filter(call => call._id !== id));
  };

  return (
    <div className="p-6">
      <h2 className="text-xl mb-4">Активные SOS-вызовы</h2>
      {calls.map(call => (
        <CallCard key={call._id} call={call} onCancel={handleCancel} />
      ))}
    </div>
  );
}
export { default as ModeratorPanel } from "./Dashboard";
