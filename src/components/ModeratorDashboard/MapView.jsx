// src/components/ModeratorDashboard/MapView.jsx
import React from 'react';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';

export default function MapView({ lat, lng }) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.AIzaSyBEa9adTA4gvPPd-F0OLG0Bh-YmefDpCN0
  });

  if (loadError) return <div>Ошибка загрузки карты</div>;
  if (!isLoaded) return <div>Загрузка карты…</div>;

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '200px', margin: '8px 0' }}
      center={{ lat, lng }}
      zoom={15}
    >
      <Marker position={{ lat, lng }} />
    </GoogleMap>
  );
}
