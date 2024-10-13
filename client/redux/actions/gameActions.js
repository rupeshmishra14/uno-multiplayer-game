import socket from '../../src/utils/socket';

export const drawCard = (gameId) => {
  return (dispatch) => {
    socket.emit('playTurn', { gameId, action: 'draw' });
  };
};

export const playCard = (gameId, card) => {
  return (dispatch) => {
    socket.emit('playTurn', { gameId, action: 'play', card });
    dispatch({ type: 'CLEAR_DRAWN_CARD_OPTION' });
  };
};

export const keepDrawnCard = (gameId) => {
  return (dispatch) => {
    socket.emit('playTurn', { gameId, action: 'keep' });
    dispatch({ type: 'CLEAR_DRAWN_CARD_OPTION' });
  };
};
