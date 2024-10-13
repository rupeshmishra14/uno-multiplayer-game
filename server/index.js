const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const gameController = require('./controllers/gameController');
const socketHandler = require('./socketHandler');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch((err) => console.error('MongoDB connection error:', err));

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('New client connected');
  socketHandler(io, socket);
});

// API routes
app.get('/', (req, res) => {
  res.send('UNO Game Server is running');
});

app.post('/api/games', gameController.createGame);
app.post('/api/games/join', gameController.joinGame);
app.post('/api/games/start', gameController.startGame);
app.post('/api/games/play-card', gameController.playCard);
app.post('/api/games/draw-card', gameController.drawCard);
app.post('/api/games/player-ready', gameController.playerReady);

// Add these new routes
app.post('/api/games/kick-player', gameController.kickPlayer);
app.post('/api/games/promote-admin', gameController.promoteToAdmin);

// Add this near your other API routes
app.get('/api/games/state', gameController.getGameState);

// Add this near your other API routes
app.post('/api/games/reset', gameController.resetGame);

// Add this new route
app.post('/api/games/draw-and-play', gameController.drawAndPlay);

// After creating the io object
app.set('io', io);

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
