const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  username: String,
  isAdmin: { type: Boolean, default: false },
  isReady: { type: Boolean, default: false },
  hand: [String],
});

const logEntrySchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  action: String,
  player: String,
  details: mongoose.Schema.Types.Mixed
});

const gameSchema = new mongoose.Schema({
  gameId: { type: String, unique: true, required: true },
  adminPlayer: String,
  players: [playerSchema],
  status: { type: String, enum: ['lobby', 'active', 'ended'], default: 'lobby' },
  deck: [String],
  discardPile: [String],
  currentTurn: { type: Number, default: 0 },
  direction: { type: Number, default: 1 },
  lastAction: { type: String, default: '' },
  winner: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  logs: [logEntrySchema]
});

module.exports = mongoose.model('Game', gameSchema);