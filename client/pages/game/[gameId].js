import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import socket, { connectSocket, joinGame, playCard, drawCard, sayUno, getGameState, listenForGameStateUpdates, stopListeningForGameStateUpdates } from '../../src/utils/socket';
import styles from '../../styles/Game.module.css';

export default function Game() {
  const router = useRouter();
  const { gameId } = router.query;
  const [gameState, setGameState] = useState(null);
  const [playerHand, setPlayerHand] = useState([]);
  const [error, setError] = useState(null);
  const [showUnoButton, setShowUnoButton] = useState(false);
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(true);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const maxRetries = 3;

  const updateGameState = useCallback((newGameState) => {
    console.log('Updating game state:', newGameState);
    setGameState(newGameState);
    if (newGameState.playerHand) {
      console.log('Setting player hand:', newGameState.playerHand);
      setPlayerHand(newGameState.playerHand);
      setShowUnoButton(newGameState.playerHand.length === 2);
    } else {
      console.warn('Player hand not found in game state');
    }
    setLoading(false);
  }, []);

  const setupGame = useCallback(async () => {
    if (gameId && username) {
      try {
        await connectSocket();
        console.log(`Joining game ${gameId} as ${username}`);
        joinGame(gameId, username);

        const initialGameState = await getGameState(gameId, username);
        console.log('Initial game state:', initialGameState);
        updateGameState(initialGameState);

        socket.on('gameUpdate', (updatedGameState) => {
          console.log('Received game update:', updatedGameState);
          updateGameState(updatedGameState);
        });

        socket.on('error', (errorMessage) => {
          console.error('Socket error:', errorMessage);
          setError(errorMessage);
          setTimeout(() => setError(null), 3000);
        });
      } catch (err) {
        console.error('Error setting up game:', err);
        setError(`Failed to connect to the game server: ${err.message}`);
        setLoading(false);
      }
    }
  }, [gameId, username, updateGameState]);

  useEffect(() => {
    console.log('NEXT_PUBLIC_SOCKET_URL:', process.env.NEXT_PUBLIC_SOCKET_URL);
    const storedUsername = localStorage.getItem('username');
    if (storedUsername) {
      setUsername(storedUsername);
    } else {
      router.push('/');
      return;
    }

    if (gameId && username) {
      setupGame();
      listenForGameStateUpdates(updateGameState);
    }

    return () => {
      if (gameId) {
        console.log(`Leaving game ${gameId}`);
        stopListeningForGameStateUpdates();
        socket.disconnect();
      }
    };
  }, [gameId, username, router, setupGame]);

  useEffect(() => {
    if (error && connectionAttempts < maxRetries) {
      const timer = setTimeout(() => {
        setConnectionAttempts(prev => prev + 1);
        setError(null);
        setLoading(true);
        setupGame();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [error, connectionAttempts, setupGame]);

  useEffect(() => {
    console.log('Player hand updated:', playerHand);
  }, [playerHand]);

  const handlePlayCard = async (card) => {
    try {
      await playCard(gameId, username, card);
    } catch (error) {
      setError(`Failed to play card: ${error.message}`);
    }
  };

  const handleDrawCard = async () => {
    try {
      await drawCard(gameId, username);
      // The game state will be updated via the gameStateUpdate event
    } catch (error) {
      setError(`Failed to draw card: ${error.message}`);
    }
  };

  const handleSayUno = () => {
    sayUno(gameId, username);
  };

  const isValidPlay = (playedCard, topCard) => {
    const [playedColor, playedValue] = playedCard.split('_');
    const [topColor, topValue] = topCard.split('_');
  
    return playedColor === topColor || playedValue === topValue || playedColor === 'wild';
  };

  const getCardColorClass = (card) => {
    const [color] = card.split('_');
    switch (color) {
      case 'red': return styles.redCard;
      case 'blue': return styles.blueCard;
      case 'green': return styles.greenCard;
      case 'yellow': return styles.yellowCard;
      default: return styles.wildCard;
    }
  };

  const isPlayerTurn = gameState && gameState.players[gameState.currentTurn].username === username;

  if (loading) return (
    <div className={styles.gameContainer}>
      <p>Loading... Please wait while we set up the game.</p>
      {connectionAttempts > 0 && (
        <p>Connection attempt {connectionAttempts} of {maxRetries}...</p>
      )}
    </div>
  );

  if (error && connectionAttempts >= maxRetries) return (
    <div className={styles.gameContainer}>
      <p>Error: {error}</p>
      <p>Unable to connect after {maxRetries} attempts. Please check your internet connection and try refreshing the page.</p>
    </div>
  );

  if (!gameState) return <div className={styles.gameContainer}><p>Error: Unable to load game state. Please try refreshing the page.</p></div>;

  return (
    <div className={styles.gameContainer}>
      <div className={styles.gameBoard}>
        <h1>UNO Game</h1>
        <div className={styles.gameInfo}>
          <p>Game ID: {gameId}</p>
          <p>Current Turn: {gameState.players[gameState.currentTurn].username}</p>
          <div className={`${styles.topCard} ${getCardColorClass(gameState.topCard)}`}>
            <span className={styles.cardContent}>{gameState.topCard}</span>
          </div>
        </div>
        {isPlayerTurn && (
          <div className={styles.turnIndicator}>
            It's your turn!
          </div>
        )}
        <div className={styles.playerHandContainer}>
          <h2>Your Hand</h2>
          <div className={styles.playerHand}>
            {playerHand && playerHand.length > 0 ? (
              playerHand.map((card, index) => {
                const isValid = isPlayerTurn && isValidPlay(card, gameState.topCard);
                return (
                  <button 
                    key={index} 
                    onClick={() => handlePlayCard(card)} 
                    className={`${styles.card} ${getCardColorClass(card)} ${isValid ? styles.validCard : ''}`}
                    disabled={!isPlayerTurn || !isValid}
                  >
                    <span className={styles.cardContent}>{card}</span>
                  </button>
                );
              })
            ) : (
              <p>No cards in hand</p>
            )}
          </div>
        </div>
        <div className={styles.actionButtons}>
          <button 
            onClick={handleDrawCard} 
            className={styles.drawButton}
            disabled={!isPlayerTurn}
          >
            Draw Card
          </button>
          {showUnoButton && (
            <button 
              onClick={handleSayUno} 
              className={styles.unoButton}
              disabled={!isPlayerTurn}
            >
              Say UNO!
            </button>
          )}
        </div>
        <div className={styles.playerStats}>
          <h3>Player Stats</h3>
          <ul className={styles.playerStatsList}>
            {gameState.players.map((player, index) => (
              <li 
                key={index} 
                className={`${styles.playerStatsItem} ${player.username === gameState.players[gameState.currentTurn].username ? styles.currentTurnPlayer : ''}`}
              >
                {player.username}: {player.handSize} cards
                {player.saidUno && ' (UNO!)'}
                {player.username === gameState.players[gameState.currentTurn].username && ' (Current Turn)'}
              </li>
            ))}
          </ul>
        </div>
      </div>
      {error && <div className={styles.errorPopup}>{error}</div>}
    </div>
  );
}
