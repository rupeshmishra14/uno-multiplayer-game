import { useState, useEffect, useCallback, useRef } from 'react';
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
  const gameStateInterval = useRef(null);

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

    // Check for game over condition
    if (newGameState.status === 'ended' && newGameState.winner) {
      localStorage.setItem('winner', newGameState.winner);
      router.push(`/game-over/${gameId}`);
    }
  }, [gameId, router]);

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

  const fetchGameState = useCallback(async () => {
    if (gameId && username) {
      try {
        const updatedGameState = await getGameState(gameId, username);
        updateGameState(updatedGameState);
      } catch (error) {
        console.error('Error fetching game state:', error);
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

      // Set up interval to fetch game state every 5 seconds
      gameStateInterval.current = setInterval(fetchGameState, 5000);
    }

    return () => {
      if (gameId) {
        console.log(`Leaving game ${gameId}`);
        stopListeningForGameStateUpdates();
        socket.disconnect();
        if (gameStateInterval.current) {
          clearInterval(gameStateInterval.current);
        }
      }
    };
  }, [gameId, username, router, setupGame, fetchGameState]);

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

  const getCardSymbol = (card) => {
    const [, value] = card.split('_');
    switch (value) {
      case 'skip': return '⊘';
      case 'reverse': return '⇄';
      case 'draw2': return '+2';
      case 'wild': return '🌈';
      case 'wild_draw4': return '+4';
      default: return value;
    }
  };

  // Update the calculatePlayerPositions function
  const calculatePlayerPositions = (numPlayers) => {
    const positions = [];
    
    if (numPlayers <= 3) {
      // For 2-3 players, place them in a row at the top
      for (let i = 0; i < numPlayers; i++) {
        positions.push({
          x: `${(i + 1) * 100 / (numPlayers + 1)}%`,
          y: '0%',
          transform: 'translateX(-50%)'
        });
      }
    } else {
      // For 4 or more players, use a semi-circle layout
      const radius = 40;
      const startAngle = -Math.PI / 2;
      const angleStep = Math.PI / (numPlayers - 1);

      for (let i = 0; i < numPlayers; i++) {
        const angle = startAngle + i * angleStep;
        const x = 50 + radius * Math.cos(angle);
        const y = 50 + radius * Math.sin(angle);
        positions.push({
          x: `${x}%`,
          y: `${y}%`,
          transform: 'translate(-50%, -50%)'
        });
      }
    }

    return positions;
  };

  // Update the renderOtherPlayersHands function
  const renderOtherPlayersHands = () => {
    if (!gameState || !gameState.players) return null;

    const otherPlayers = gameState.players.filter(player => player.username !== username);
    const positions = calculatePlayerPositions(otherPlayers.length);

    return otherPlayers.map((player, index) => {
      const { x, y, transform } = positions[index];
      const style = { left: x, top: y, transform };

      return (
        <div 
          key={player.username} 
          className={`${styles.otherPlayerHand} ${player.username === gameState.players[gameState.currentTurn].username ? styles.currentTurnHand : ''}`}
          style={style}
        >
          <div className={styles.otherPlayerName}>{player.username}</div>
          <div className={styles.otherPlayerCards}>
            {Array(Math.min(7, player.handSize)).fill(0).map((_, cardIndex) => (
              <div key={cardIndex} className={styles.otherPlayerCard}></div>
            ))}
          </div>
          {player.handSize > 7 && (
            <div className={styles.extraCards}>+{player.handSize - 7}</div>
          )}
        </div>
      );
    });
  };

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
        <div className={styles.gameInfo}>
          <div className={styles.gameInfoHeader}>
            <h3>Game Info</h3>
            <div className={styles.gameId}>ID: {gameId}</div>
          </div>
          <div className={styles.playerStatsContainer}>
            {gameState.players.map((player, index) => (
              <div 
                key={index} 
                className={`${styles.playerStatsItem} ${player.username === gameState.players[gameState.currentTurn].username ? styles.currentTurnPlayer : ''}`}
              >
                <div className={styles.playerNameAndCards}>
                  <span className={styles.playerName}>{player.username}</span>
                  <span className={styles.playerCardCount}>({player.handSize})</span>
                </div>
                <div className={styles.playerDetails}>
                  {player.saidUno && <span className={styles.unoIndicator}>UNO!</span>}
                  {player.username === gameState.players[gameState.currentTurn].username && (
                    <span className={styles.currentTurnIndicator}>Current Turn</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.gamePlayArea}>
          <div className={styles.gameContent}>
            <div className={styles.otherPlayersContainer}>
              {renderOtherPlayersHands()}
            </div>
            <div className={styles.centralArea}>
              <div className={styles.discardPile}>
                <div className={`${styles.topCard} ${getCardColorClass(gameState.topCard)}`}>
                  <div className={styles.topCardContent}>
                    <span className={`${styles.cardCorner} ${styles.cardCornerTopLeft}`}>{getCardSymbol(gameState.topCard)}</span>
                    <span className={styles.cardCenter}>{getCardSymbol(gameState.topCard)}</span>
                    <span className={`${styles.cardCorner} ${styles.cardCornerBottomRight}`}>{getCardSymbol(gameState.topCard)}</span>
                  </div>
                </div>
                <div 
                  className={styles.drawPile}
                  onClick={handleDrawCard}
                  style={{ cursor: isPlayerTurn ? 'pointer' : 'not-allowed' }}
                />
              </div>
            </div>
            <div className={styles.currentPlayerHand}>
              <div className={styles.actionButtons}>
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
                        <div className={styles.cardContent}>
                          <span className={`${styles.cardCorner} ${styles.cardCornerTopLeft}`}>{getCardSymbol(card)}</span>
                          <span className={styles.cardCenter}>{getCardSymbol(card)}</span>
                          <span className={`${styles.cardCorner} ${styles.cardCornerBottomRight}`}>{getCardSymbol(card)}</span>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <p>No cards in hand</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      {error && <div className={styles.errorPopup}>{error}</div>}
    </div>
  );
}