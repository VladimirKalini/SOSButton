module.exports = {
  apps: [
    {
      name: 'sos-backend',
      script: './server.js',
      cwd: '/var/www/sos-app',   
      watch: true,                
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
        MONGO_URI: 'mongodb://localhost:27017/sos-app'
      }
    },
    {
      name: 'video-cleanup',
      script: './src/scripts/cleanupVideos.js',
      cwd: '/var/www/sos-app',
      watch: false,
      cron_restart: '0 0 * * *', // Запуск каждый день в полночь
      autorestart: false,
      env: {
        NODE_ENV: 'production',
        MONGO_URI: 'mongodb://localhost:27017/sos-app'
      }
    }
  ]
}
