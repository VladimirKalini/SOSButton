require('debug').disable()
const express  = require('express')
const http     = require('http')
const { Server } = require('socket.io')
const path     = require('path')
const mongoose = require('mongoose')
const authRoutes = require('./src/routes/auth')

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/sos-app'
mongoose.connect(mongoUri).then(() => console.log('MongoDB connected')).catch(err => {
  console.error(err)
  process.exit(1)
})




const app = express()
const httpServer = http.createServer(app)

app.use(express.json())
app.use('/api', authRoutes)
app.use(express.static(path.join(__dirname, 'build')))
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/socket.io') && !req.path.includes('.')) {
    return res.sendFile(path.join(__dirname, 'build', 'index.html'))
  }
  next()
})

const io = new Server(httpServer, { cors: { origin: '*' } })
io.on('connection', socket => {
  socket.on('join-room', room => socket.join(room))
  socket.on('sos-offer', p => socket.to('moderators').emit('incoming-sos', p))
  socket.on('ice-candidate', ({ candidate, id }) => socket.to(id).emit('ice-candidate', candidate))
})

const PORT = process.env.PORT || 4000
httpServer.listen(PORT, '0.0.0.0', () => console.log(`Server running on 0.0.0.0:${PORT}`))
