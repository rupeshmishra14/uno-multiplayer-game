import { io } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000';

console.log('Initializing socket with URL:', SOCKET_URL);

const socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 10000,
  transports: ['websocket', 'polling'],
});

socket.on('connect', () => {
  console.log('Socket connected successfully');
});

socket.on('connect_error', (error) => {
  console.error('Socket connection error:', error);
});

export const connectSocket = () => {
  return new Promise((resolve, reject) => {
    if (socket.connected) {
      resolve(socket);
      return;
    }

    socket.connect();

    socket.once('connect', () => {
      resolve(socket);
    });

    socket.once('connect_error', (error) => {
      reject(error);
    });
  });
};

export const joinGame = (gameId, username) => {
  socket.emit('joinGame', { gameId, username });
};

export const playCard = (gameId, username, card) => {
  return new Promise((resolve, reject) => {
    socket.emit('playCard', { gameId, username, card }, (response) => {
      if (response.error) {
        reject(response.error);
      } else {
        resolve(response);
      }
    });
  });
};

export const drawCard = (gameId, username) => {
  return new Promise((resolve, reject) => {
    socket.emit('drawCard', { gameId, username }, (response) => {
      if (response.error) {
        reject(response.error);
      } else {
        resolve(response);
      }
    });
  });
};

export const sayUno = (gameId, username) => {
  socket.emit('sayUno', { gameId, username });
};

export const getGameState = (gameId, username) => {
  return new Promise((resolve, reject) => {
    socket.emit('getGameState', { gameId, username }, (response) => {
      if (response.error) {
        reject(response.error);
      } else {
        console.log('Received game state:', response);
        resolve(response);
      }
    });
  });
};

export const listenForGameStateUpdates = (callback) => {
  socket.on('gameStateUpdate', (gameState) => {
    console.log('Received game state update:', gameState);
    if (gameState.playerHand) {
      console.log('Player hand in update:', gameState.playerHand);
    } else {
      console.warn('Player hand not found in game state update');
    }
    callback(gameState);
  });
};

export const stopListeningForGameStateUpdates = () => {
  socket.off('gameStateUpdate');
};

export default socket;
