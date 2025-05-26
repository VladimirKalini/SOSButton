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
    }
  ]
}
