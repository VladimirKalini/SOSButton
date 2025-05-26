require('debug').disable();
const express    = require('express');
const http       = require('http');
const path       = require('path');
const mongoose   = require('mongoose');
const { Server } = require('socket.io');

const authRoutes  = require('./src/routes/auth');
const callsRoutes = require('./src/routes/calls');
const Sos         = require('./src/models/Sos');

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/sos-app';
mongoose
  .connect(mongoUri)
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

const app        = express();
const httpServer = http.createServer(app);
const io         = new Server(httpServer, { cors: { origin: '*' } });

app.set('io', io);

app.use(express.json());
app.use('/api', authRoutes);
app.use('/api/calls', callsRoutes);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'build')));
app.use((req, res, next) => {
  if (
    req.method === 'GET' &&
    !req.path.startsWith('/api') &&
    !req.path.startsWith('/socket.io') &&
    !req.path.includes('.')
  ) {
    return res.sendFile(path.join(__dirname, 'build', 'index.html'));
  }
  next();
});

io.on('connection', socket => {
  socket.on('join-room', room => socket.join(room));

  socket.on('sos-offer', async ({ offer, latitude, longitude, phone, id }) => {
    const doc = new Sos({ phone, latitude, longitude, offer, sosId: id });
    await doc.save();
    socket.emit('sos-saved', { id: doc._id });
    socket.to('moderators').emit('incoming-sos', {
      offer,
      latitude,
      longitude,
      phone,
      id: doc._id
    });
  });

  socket.on('ice-candidate', ({ candidate, id }) => {
    socket.to(id).emit('ice-candidate', candidate);
  });
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on 0.0.0.0:${PORT}`);
});
