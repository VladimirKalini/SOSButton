import React from 'react';

/**
 * Полноэкранное модальное окно для подтверждения SOS вызова
 * Показывается даже на заблокированном экране
 * 
 * @param {Object} props - Свойства компонента
 * @param {Object} props.data - Данные о вызове
 * @param {Function} props.onAccept - Функция при принятии вызова
 * @param {Function} props.onDecline - Функция при отклонении вызова
 * @param {Function} props.onClose - Функция при закрытии оверлея
 */
const SOSConfirmationOverlay = ({ data, onAccept, onDecline, onClose }) => {
  // Извлекаем данные о вызове
  const { sosId, userName, phone, latitude, longitude, createdAt } = data || {};
  
  // Форматируем дату, если она есть
  const formattedDate = createdAt ? new Date(createdAt).toLocaleString() : 'Неизвестно';
  
  // Обработчики кнопок
  const handleAccept = () => {
    if (onAccept) onAccept(data);
  };
  
  const handleDecline = () => {
    if (onDecline) onDecline(data);
  };
  
  const handleClose = () => {
    if (onClose) onClose();
  };
  
  return (
    <div className="sos-overlay">
      <div className="sos-overlay-content">
        <div className="sos-overlay-header">
          <h2>Внимание! SOS!</h2>
          <button className="close-button" onClick={handleClose}>×</button>
        </div>
        
        <div className="sos-overlay-body">
          <div className="sos-info">
            <p><strong>Пользователь:</strong> {userName || 'Неизвестно'}</p>
            <p><strong>Телефон:</strong> {phone || 'Неизвестно'}</p>
            <p><strong>Время:</strong> {formattedDate}</p>
            {latitude && longitude && (
              <p><strong>Координаты:</strong> {latitude.toFixed(6)}, {longitude.toFixed(6)}</p>
            )}
          </div>
          
          <div className="sos-map">
            {latitude && longitude && (
              <a 
                href={`https://www.google.com/maps?q=${latitude},${longitude}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="map-link"
              >
                Открыть на карте
              </a>
            )}
          </div>
        </div>
        
        <div className="sos-overlay-footer">
          <button className="decline-button" onClick={handleDecline}>Отклонить</button>
          <button className="accept-button" onClick={handleAccept}>Принять</button>
        </div>
      </div>
      
      <style jsx>{`
        .sos-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.3s ease-out;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); box-shadow: 0 0 20px rgba(255, 0, 0, 0.7); }
          100% { transform: scale(1); }
        }
        
        .sos-overlay-content {
          background-color: white;
          border-radius: 8px;
          width: 90%;
          max-width: 500px;
          box-shadow: 0 0 20px rgba(255, 0, 0, 0.5);
          animation: pulse 1.5s infinite;
        }
        
        .sos-overlay-header {
          background-color: #dc3545;
          color: white;
          padding: 15px;
          border-radius: 8px 8px 0 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .sos-overlay-header h2 {
          margin: 0;
          font-size: 24px;
        }
        
        .close-button {
          background: none;
          border: none;
          color: white;
          font-size: 24px;
          cursor: pointer;
        }
        
        .sos-overlay-body {
          padding: 20px;
        }
        
        .sos-info p {
          margin: 10px 0;
          font-size: 16px;
        }
        
        .sos-map {
          margin-top: 20px;
          text-align: center;
        }
        
        .map-link {
          display: inline-block;
          background-color: #007bff;
          color: white;
          padding: 8px 16px;
          border-radius: 4px;
          text-decoration: none;
          font-weight: bold;
        }
        
        .sos-overlay-footer {
          padding: 15px;
          display: flex;
          justify-content: space-between;
          border-top: 1px solid #dee2e6;
        }
        
        .accept-button, .decline-button {
          padding: 10px 20px;
          border: none;
          border-radius: 4px;
          font-weight: bold;
          cursor: pointer;
          width: 45%;
        }
        
        .accept-button {
          background-color: #28a745;
          color: white;
        }
        
        .decline-button {
          background-color: #dc3545;
          color: white;
        }
        
        @media (max-width: 768px) {
          .sos-overlay-content {
            width: 95%;
          }
          
          .sos-overlay-header h2 {
            font-size: 20px;
          }
          
          .sos-info p {
            font-size: 14px;
          }
        }
      `}</style>
    </div>
  );
};

export default SOSConfirmationOverlay; 