const Game = require('../models/Game');
const { generateDeck, shuffleDeck, dealCards } = require('../utils/cardUtils');
const { addGameLog } = require('../utils/logUtils');

exports.createGame = async (req, res) => {
  try {
    const { username } = req.body;
    const gameId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const deck = shuffleDeck(generateDeck());

    const game = new Game({
      gameId,
      adminPlayer: username,
      players: [{ username, isAdmin: true, isReady: true }],
      deck,
    });

    await game.save();
    await addGameLog(game, 'CREATE_GAME', username, { gameId });

    console.log(`Game created: ${gameId}, Admin: ${username}`);
    console.log('Initial game state:', game);

    res.status(201).json({ gameId, message: 'Game created successfully' });
  } catch (error) {
    console.error('Error creating game:', error);
    res.status(500).json({ message: 'Error creating game', error: error.message });
  }
};

exports.joinGame = async (req, res) => {
  try {
    const { gameId, username } = req.body;
    const game = await Game.findOne({ gameId });

    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }

    if (game.status !== 'lobby') {
      return res.status(400).json({ message: 'Game has already started' });
    }

    if (game.players.some(player => player.username === username)) {
      return res.status(400).json({ message: 'Username already taken' });
    }

    game.players.push({ username, isReady: false });
    await game.save();
    await addGameLog(game, 'JOIN_GAME', username, {});

    // Emit an event to all connected clients about the new player
    req.app.get('io').to(gameId).emit('playerJoined', { username, isReady: false });

    res.status(200).json({ message: 'Joined game successfully', players: game.players });
  } catch (error) {
    res.status(500).json({ message: 'Error joining game', error: error.message });
  }
};

exports.startGame = async (req, res) => {
  try {
    const { gameId, username } = req.body;
    console.log(`Attempting to start game: ${gameId} by user: ${username}`);
    
    const game = await Game.findOne({ gameId });

    if (!game) {
      console.log(`Game not found: ${gameId}`);
      return res.status(404).json({ message: 'Game not found' });
    }

    if (game.status !== 'lobby') {
      console.log(`Game ${gameId} has already started`);
      return res.status(400).json({ message: 'Game has already started' });
    }

    if (game.adminPlayer !== username) {
      console.log(`User ${username} is not the admin of game ${gameId}`);
      return res.status(403).json({ message: 'Only the admin can start the game' });
    }

    if (game.players.length < 2) {
      console.log(`Not enough players in game ${gameId}`);
      return res.status(400).json({ message: 'Not enough players to start the game' });
    }

    if (!game.players.every(player => player.isReady)) {
      console.log(`Not all players are ready in game ${gameId}`);
      return res.status(400).json({ message: 'Not all players are ready' });
    }

    console.log(`Dealing cards for game ${gameId}`);
    const { hands, remainingDeck, firstCard } = dealCards(game.deck, game.players.length);
    game.players.forEach((player, index) => {
      player.hand = hands[index];
    });

    game.deck = remainingDeck;
    game.discardPile = [firstCard];
    game.status = 'active';
    game.currentTurn = 0;

    console.log(`Saving game state for ${gameId}`);
    await game.save();

    console.log(`Game ${gameId} started successfully`);
    // Emit gameStarted event to all players in the game
    req.app.get('io').to(gameId).emit('gameStarted', { gameId });

    res.status(200).json({ message: 'Game started successfully' });
  } catch (error) {
    console.error('Error starting game:', error);
    res.status(500).json({ message: 'Error starting game', error: error.message, stack: error.stack });
  }
};

exports.playCard = async (req, res) => {
  try {
    const { gameId, username, card } = req.body;
    const game = await Game.findOne({ gameId });

    if (!game || game.status !== 'active') {
      return res.status(400).json({ message: 'Invalid game' });
    }

    const playerIndex = game.players.findIndex(player => player.username === username);
    if (playerIndex === -1 || playerIndex !== game.currentTurn) {
      return res.status(403).json({ message: 'Not your turn' });
    }

    const player = game.players[playerIndex];
    const cardIndex = player.hand.indexOf(card);
    if (cardIndex === -1) {
      return res.status(400).json({ message: 'Card not in hand' });
    }

    const topCard = game.discardPile[game.discardPile.length - 1];
    if (!isValidPlay(card, topCard)) {
      return res.status(400).json({ message: 'Invalid card play' });
    }

    // Remove the card from the player's hand
    player.hand.splice(cardIndex, 1);
    
    // Remove the wild card handling
    game.discardPile.push(card);

    // Handle special card effects
    handleSpecialCard(game, card);

    // Move to the next player's turn
    game.currentTurn = (game.currentTurn + game.direction + game.players.length) % game.players.length;

    // Check for win condition
    if (player.hand.length === 0) {
      game.status = 'ended';
      game.winner = username;
      await game.save();
      await emitGameStateUpdate(gameId, req.app.get('io'));
      return res.status(200).json({ message: 'Game over', winner: username });
    }

    await game.save();
    await emitGameStateUpdate(gameId, req.app.get('io'));

    res.status(200).json({ message: 'Card played successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error playing card', error: error.message });
  }
};

exports.drawCard = async (req, res) => {
  try {
    const { gameId, username } = req.body;
    const game = await Game.findOne({ gameId });

    if (!game || game.status !== 'active') {
      return res.status(400).json({ message: 'Invalid game' });
    }

    const playerIndex = game.players.findIndex(player => player.username === username);
    if (playerIndex === -1 || playerIndex !== game.currentTurn) {
      return res.status(403).json({ message: 'Not your turn' });
    }

    const player = game.players[playerIndex];

    // Draw a card from the deck
    if (game.deck.length === 0) {
      game.deck = shuffleDeck(game.discardPile.slice(0, -1));
      game.discardPile = [game.discardPile[game.discardPile.length - 1]];
    }

    const drawnCard = game.deck.pop();
    const topCard = game.discardPile[game.discardPile.length - 1];

    const canPlayDrawnCard = isValidPlay(drawnCard, topCard);

    if (canPlayDrawnCard) {
      // If the drawn card can be played, don't add it to the player's hand yet
      res.status(200).json({ message: 'Card drawn successfully', drawnCard, canPlayDrawnCard });
    } else {
      // If the drawn card can't be played, add it to the player's hand and move to the next turn
      player.hand.push(drawnCard);
      game.currentTurn = (game.currentTurn + game.direction + game.players.length) % game.players.length;
      await game.save();
      await emitGameStateUpdate(gameId, req.app.get('io'));
      res.status(200).json({ message: 'Card drawn successfully', drawnCard, canPlayDrawnCard });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error drawing card', error: error.message });
  }
};

function isValidPlay(playedCard, topCard) {
  const [playedColor, playedValue] = playedCard.split('_');
  const [topColor, topValue] = topCard.split('_');

  return playedColor === topColor || playedValue === topValue;
}

function handleSpecialCard(game, card) {
  const [, value] = card.split('_');

  switch (value) {
    case 'reverse':
      game.direction *= -1;
      break;
    case 'skip':
      game.currentTurn = (game.currentTurn + game.direction + game.players.length) % game.players.length;
      break;
    case 'draw2':
      const nextPlayer = game.players[(game.currentTurn + game.direction + game.players.length) % game.players.length];
      for (let i = 0; i < 2; i++) {
        if (game.deck.length === 0) {
          game.deck = shuffleDeck(game.discardPile.slice(0, -1));
          game.discardPile = [game.discardPile[game.discardPile.length - 1]];
        }
        nextPlayer.hand.push(game.deck.pop());
      }
      break;
  }
}

// Add this new function to handle player ready status
exports.playerReady = async (req, res) => {
  try {
    const { gameId, username, isReady } = req.body;
    const game = await Game.findOne({ gameId });

    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }

    const player = game.players.find(p => p.username === username);
    if (!player) {
      return res.status(404).json({ message: 'Player not found' });
    }

    player.isReady = isReady;
    await game.save();

    res.status(200).json({ message: 'Player ready status updated' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating player ready status', error: error.message });
  }
};

// Add these new functions to the existing file

exports.kickPlayer = async (req, res) => {
  try {
    const { gameId, adminUsername, playerToKick } = req.body;
    const game = await Game.findOne({ gameId });

    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }

    if (game.adminPlayer !== adminUsername) {
      return res.status(403).json({ message: 'Only the admin can kick players' });
    }

    game.players = game.players.filter(player => player.username !== playerToKick);
    await game.save();

    res.status(200).json({ message: 'Player kicked successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error kicking player', error: error.message });
  }
};

exports.promoteToAdmin = async (req, res) => {
  try {
    const { gameId, currentAdminUsername, newAdminUsername } = req.body;
    const game = await Game.findOne({ gameId });

    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }

    if (game.adminPlayer !== currentAdminUsername) {
      return res.status(403).json({ message: 'Only the current admin can promote players' });
    }

    const newAdminPlayer = game.players.find(player => player.username === newAdminUsername);
    if (!newAdminPlayer) {
      return res.status(404).json({ message: 'Player to promote not found' });
    }

    game.adminPlayer = newAdminUsername;
    newAdminPlayer.isAdmin = true;
    game.players.find(player => player.username === currentAdminUsername).isAdmin = false;

    await game.save();

    res.status(200).json({ message: 'Player promoted to admin successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error promoting player to admin', error: error.message });
  }
};

exports.getGameState = async (req, res) => {
  try {
    const { gameId, username } = req.query;
    const game = await Game.findOne({ gameId });

    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }

    const player = game.players.find(p => p.username === username);
    if (!player) {
      return res.status(403).json({ message: 'Player not in game' });
    }

    const gameState = {
      gameId: game.gameId,
      players: game.players.map(p => ({
        username: p.username,
        handSize: p.hand.length,
        isAdmin: p.isAdmin,
        isReady: p.isReady,
        saidUno: p.saidUno
      })),
      currentTurn: game.currentTurn,
      direction: game.direction,
      topCard: game.discardPile[game.discardPile.length - 1],
      status: game.status,
      winner: game.winner,
      playerHand: player.hand
    };

    res.status(200).json(gameState);
  } catch (error) {
    console.error('Error getting game state:', error);
    res.status(500).json({ message: 'Error getting game state', error: error.message });
  }
};

const emitGameStateUpdate = async (gameId, io) => {
  const game = await Game.findOne({ gameId });
  if (game) {
    game.players.forEach(player => {
      const gameState = {
        gameId: game.gameId,
        players: game.players.map(p => ({
          username: p.username,
          handSize: p.hand.length,
          isAdmin: p.isAdmin,
          isReady: p.isReady,
          saidUno: p.saidUno
        })),
        currentTurn: game.currentTurn,
        direction: game.direction,
        topCard: game.discardPile[game.discardPile.length - 1],
        status: game.status,
        winner: game.winner,
        playerHand: player.hand
      };
      console.log(`Emitting game state to ${player.username}:`, gameState);
      io.to(player.socketId).emit('gameStateUpdate', gameState);
    });
  }
};

// Add this function to reset the game
exports.resetGame = async (req, res) => {
  try {
    const { gameId } = req.body;
    const game = await Game.findOne({ gameId });

    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }

    // Reset game state
    game.status = 'lobby';
    game.deck = shuffleDeck(generateDeck());
    game.discardPile = [];
    game.currentTurn = 0;
    game.direction = 1;
    game.winner = null;

    // Reset player hands and ready status
    game.players.forEach(player => {
      player.hand = [];
      player.isReady = false;
    });

    await game.save();

    // Emit a game reset event to all players
    req.app.get('io').to(gameId).emit('gameReset', { gameId });

    res.status(200).json({ message: 'Game reset successfully' });
  } catch (error) {
    console.error('Error resetting game:', error);
    res.status(500).json({ message: 'Error resetting game', error: error.message });
  }
};

// Add this new function at the end of the file
exports.drawAndPlay = async (req, res) => {
  try {
    const { gameId, username, action } = req.body;
    const game = await Game.findOne({ gameId });

    if (!game || game.status !== 'active') {
      return res.status(400).json({ message: 'Invalid game' });
    }

    const playerIndex = game.players.findIndex(player => player.username === username);
    if (playerIndex === -1 || playerIndex !== game.currentTurn) {
      return res.status(403).json({ message: 'Not your turn' });
    }

    const player = game.players[playerIndex];

    // Draw a card
    if (game.deck.length === 0) {
      game.deck = shuffleDeck(game.discardPile.slice(0, -1));
      game.discardPile = [game.discardPile[game.discardPile.length - 1]];
    }

    const drawnCard = game.deck.pop();
    const topCard = game.discardPile[game.discardPile.length - 1];

    if (action === 'play' && isValidPlay(drawnCard, topCard)) {
      // Play the drawn card
      game.discardPile.push(drawnCard);
      handleSpecialCard(game, drawnCard);
    } else {
      // Keep the drawn card
      player.hand.push(drawnCard);
    }

    // Move to the next player's turn
    game.currentTurn = (game.currentTurn + game.direction + game.players.length) % game.players.length;

    await game.save();
    await emitGameStateUpdate(gameId, req.app.get('io'));

    res.status(200).json({ message: 'Card drawn and action taken successfully', drawnCard });
  } catch (error) {
    res.status(500).json({ message: 'Error drawing and playing card', error: error.message });
  }
};