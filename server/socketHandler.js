const Game = require('./models/Game');
const { isValidPlay, handleSpecialCard } = require('./utils/gameLogic');

module.exports = (io, socket) => {
  console.log('New client connected');

  const emitGameUpdate = async (gameId) => {
    const game = await Game.findOne({ gameId });
    if (game) {
      io.to(gameId).emit('gameUpdate', {
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
        winner: game.winner
      });
    }
  };

  socket.on('joinGame', async ({ gameId, username }) => {
    try {
      console.log(`Player ${username} joining game ${gameId}`);
      const game = await Game.findOne({ gameId });
      if (game) {
        const player = game.players.find(p => p.username === username);
        if (player) {
          player.socketId = socket.id; // Store the socket ID
          await game.save();
          console.log(`Player ${username} hand:`, player.hand);
        }
      }
      socket.join(gameId);
      await emitGameUpdate(gameId);
    } catch (error) {
      console.error('Error joining game:', error);
      socket.emit('error', 'Error joining game');
    }
  });

  socket.on('playerReady', async ({ gameId, username, isReady }) => {
    try {
      const game = await Game.findOne({ gameId });
      if (!game) {
        socket.emit('error', 'Game not found');
        return;
      }

      const player = game.players.find(p => p.username === username);
      if (player) {
        player.isReady = isReady;
        await game.save();
        await emitGameUpdate(gameId);
      }
    } catch (error) {
      console.error('Error updating player ready status:', error);
      socket.emit('error', 'Error updating player ready status');
    }
  });

  socket.on('startGame', async ({ gameId, username }) => {
    try {
      const game = await Game.findOne({ gameId });
      if (!game) {
        socket.emit('error', 'Game not found');
        return;
      }

      if (game.adminPlayer !== username) {
        socket.emit('error', 'Only the admin can start the game');
        return;
      }

      // Add logic to start the game here
      // ...

      await game.save();
      await emitGameUpdate(gameId);
    } catch (error) {
      console.error('Error starting game:', error);
      socket.emit('error', 'Error starting game');
    }
  });

  socket.on('playCard', async ({ gameId, username, card }) => {
    try {
      const game = await Game.findOne({ gameId });
      if (!game || game.status !== 'active') {
        socket.emit('error', 'Invalid game');
        return;
      }

      const playerIndex = game.players.findIndex(player => player.username === username);
      if (playerIndex === -1 || playerIndex !== game.currentTurn) {
        socket.emit('error', 'Not your turn');
        return;
      }

      const player = game.players[playerIndex];
      const cardIndex = player.hand.indexOf(card);
      if (cardIndex === -1) {
        socket.emit('error', 'Card not in hand');
        return;
      }

      player.hand.splice(cardIndex, 1);
      game.discardPile.push(card);

      handleSpecialCard(game, card);

      game.currentTurn = (game.currentTurn + game.direction + game.players.length) % game.players.length;

      if (player.hand.length === 0) {
        game.status = 'ended';
        game.winner = username;
      }

      await game.save();
      await emitGameUpdate(gameId);
    } catch (error) {
      console.error('Error playing card:', error);
      socket.emit('error', 'Error playing card');
    }
  });

  socket.on('drawCard', async ({ gameId, username }) => {
    try {
      const game = await Game.findOne({ gameId });
      if (!game || game.status !== 'active') {
        socket.emit('error', 'Invalid game');
        return;
      }

      const playerIndex = game.players.findIndex(player => player.username === username);
      if (playerIndex === -1 || playerIndex !== game.currentTurn) {
        socket.emit('error', 'Not your turn');
        return;
      }

      const player = game.players[playerIndex];

      if (game.deck.length === 0) {
        game.deck = game.discardPile.slice(0, -1).sort(() => Math.random() - 0.5);
        game.discardPile = [game.discardPile[game.discardPile.length - 1]];
      }

      const drawnCard = game.deck.pop();
      player.hand.push(drawnCard);

      game.currentTurn = (game.currentTurn + game.direction + game.players.length) % game.players.length;

      await game.save();
      await emitGameUpdate(gameId);
    } catch (error) {
      console.error('Error drawing card:', error);
      socket.emit('error', 'Error drawing card');
    }
  });

  socket.on('sayUno', async ({ gameId, username }) => {
    try {
      const game = await Game.findOne({ gameId });
      if (!game || game.status !== 'active') {
        socket.emit('error', 'Invalid game');
        return;
      }

      const player = game.players.find(player => player.username === username);
      if (!player) {
        socket.emit('error', 'Player not found');
        return;
      }

      if (player.hand.length !== 1) {
        socket.emit('error', 'You can only say UNO when you have one card left');
        return;
      }

      player.saidUno = true;
      await game.save();
      await emitGameUpdate(gameId);
    } catch (error) {
      console.error('Error saying UNO:', error);
      socket.emit('error', 'Error saying UNO');
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });

  socket.on('getGameState', async ({ gameId, username }, callback) => {
    try {
      const game = await Game.findOne({ gameId });
      if (!game) {
        callback({ error: 'Game not found' });
        return;
      }

      const player = game.players.find(p => p.username === username);
      if (!player) {
        callback({ error: 'Player not in game' });
        return;
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

      callback(gameState);
    } catch (error) {
      console.error('Error getting game state:', error);
      callback({ error: 'Error getting game state' });
    }
  });

  socket.on('resetGame', async ({ gameId }) => {
    try {
      const game = await Game.findOne({ gameId });
      if (!game) {
        socket.emit('error', 'Game not found');
        return;
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

      // Emit game reset event to all players in the game
      io.to(gameId).emit('gameReset', { gameId });
    } catch (error) {
      console.error('Error resetting game:', error);
      socket.emit('error', 'Error resetting game');
    }
  });

  // Add this new socket event handler
  socket.on('drawAndPlay', async ({ gameId, username, action }) => {
    try {
      const game = await Game.findOne({ gameId });
      if (!game || game.status !== 'active') {
        socket.emit('error', 'Invalid game');
        return;
      }

      const playerIndex = game.players.findIndex(player => player.username === username);
      if (playerIndex === -1 || playerIndex !== game.currentTurn) {
        socket.emit('error', 'Not your turn');
        return;
      }

      const player = game.players[playerIndex];

      // Draw a card
      if (game.deck.length === 0) {
        game.deck = game.discardPile.slice(0, -1).sort(() => Math.random() - 0.5);
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
      await emitGameUpdate(gameId);
    } catch (error) {
      console.error('Error drawing and playing card:', error);
      socket.emit('error', 'Error drawing and playing card');
    }
  });
};
