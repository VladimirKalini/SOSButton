// src/components/ModeratorDashboard/CallCard.jsx
import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import VideoStream from './VideoStream';

export function CallCard({ call, onCancel }) {
  return (
    <Card className="p-4 mb-4">
      <div>
        <strong>{call.phone}</strong>{' '}
        <em>{new Date(call.createdAt).toLocaleString()}</em>
      </div>
      <div>
        📍 {call.latitude.toFixed(5)}, {call.longitude.toFixed(5)}
      </div>
      <Button onClick={() => onCancel(call._id)}>Завершить</Button>
      <VideoStream offer={call.offer} />
    </Card>
  );
}
