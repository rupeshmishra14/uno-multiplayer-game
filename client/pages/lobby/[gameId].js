import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import io from 'socket.io-client';
import styles from '../../styles/Lobby.module.css';

let socket;

export default function Lobby() {
  const router = useRouter();
  const { gameId } = router.query;
  const [players, setPlayers] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!gameId) return;

    const username = localStorage.getItem('username');
    if (!username) {
      router.push('/');
      return;
    }

    console.log(`Connecting to socket for game: ${gameId}, User: ${username}`);
    socket = io(process.env.NEXT_PUBLIC_API_URL);

    socket.on('connect', () => {
      console.log('Connected to server');
      socket.emit('joinLobby', { gameId, username });
    });

    socket.on('lobbyUpdate', (lobbyState) => {
      console.log('Lobby update received:', lobbyState);
      updateGameState(lobbyState);
    });

    socket.on('gameStarted', ({ gameId }) => {
      console.log('Game started event received, redirecting to game page');
      router.push(`/game/${gameId}`);
    });

    socket.on('error', (errorMessage) => {
      setError(errorMessage);
    });

    // Set up polling for game state
    const pollInterval = setInterval(() => {
      fetchGameState(gameId, username);
    }, 1000);

    // Fetch initial game state
    fetchGameState(gameId, username);

    return () => {
      socket.disconnect();
      clearInterval(pollInterval);
    };
  }, [gameId, router]);

  const updateGameState = (gameState) => {
    if (Array.isArray(gameState.players)) {
      setPlayers(gameState.players);
      const username = localStorage.getItem('username');
      const currentPlayer = gameState.players.find(p => p.username === username);
      setIsAdmin(currentPlayer?.isAdmin || false);
      setIsReady(currentPlayer?.isReady || false);
    } else {
      console.error('Invalid players data received:', gameState.players);
    }

    // Check if the game has started and redirect if necessary
    if (gameState.status === 'active') {
      router.push(`/game/${gameId}`);
    }
  };

  const fetchGameState = async (gameId, username) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/games/state?gameId=${gameId}&username=${username}`);
      const data = await response.json();
      if (response.ok) {
        updateGameState(data);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Failed to fetch game state');
    }
  };

  const handleReady = async () => {
    const username = localStorage.getItem('username');
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/games/player-ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, username, isReady: !isReady }),
      });
      if (response.ok) {
        setIsReady(!isReady);
        socket.emit('lobbyUpdate', { gameId });
      } else {
        throw new Error('Failed to update ready status');
      }
    } catch (err) {
      setError('Failed to update ready status');
    }
  };

  const handleStartGame = async () => {
    const username = localStorage.getItem('username');
    try {
      console.log(`Attempting to start game: ${gameId} by user: ${username}`);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/games/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, username }),
      });
      const data = await response.json();
      console.log('Response from server:', data);
      if (!response.ok) {
        throw new Error(data.message || 'Failed to start the game');
      }
      console.log('Game started successfully:', data);
      // The routing will be handled by the gameStarted socket event or the next game state update
    } catch (err) {
      console.error('Error starting game:', err);
      setError(`Failed to start the game: ${err.message}`);
    }
  };

  const handleKickPlayer = async (playerToKick) => {
    const adminUsername = localStorage.getItem('username');
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/games/kick-player`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, adminUsername, playerToKick }),
      });
      socket.emit('lobbyUpdate', { gameId });
    } catch (err) {
      setError('Failed to kick player');
    }
  };

  const handlePromoteToAdmin = async (newAdminUsername) => {
    const currentAdminUsername = localStorage.getItem('username');
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/games/promote-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, currentAdminUsername, newAdminUsername }),
      });
      socket.emit('lobbyUpdate', { gameId });
    } catch (err) {
      setError('Failed to promote player to admin');
    }
  };

  const allPlayersReady = players.length >= 2 && players.every(player => player.isReady);

  if (error) return <div className={styles.container}><p className={styles.error}>Error: {error}</p></div>;

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Game Lobby</h1>
      <p className={styles.gameId}>Game ID: {gameId}</p>
      <h2 className={styles.subtitle}>Players:</h2>
      {players.length === 0 ? (
        <p className={styles.noPlayers}>No players have joined yet.</p>
      ) : (
        <ul className={styles.playerList}>
          {players.map((player, index) => (
            <li key={index} className={styles.playerItem}>
              {player.username} {player.isReady ? '(Ready)' : '(Not Ready)'}
              {player.isAdmin ? ' (Admin)' : ''}
              {isAdmin && !player.isAdmin && (
                <div className={styles.adminActions}>
                  <button className={styles.kickButton} onClick={() => handleKickPlayer(player.username)}>Kick</button>
                  <button className={styles.promoteButton} onClick={() => handlePromoteToAdmin(player.username)}>Promote to Admin</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <button className={styles.readyButton} onClick={handleReady}>
        {isReady ? 'Not Ready' : 'Ready'}
      </button>
      {isAdmin && allPlayersReady && (
        <button className={styles.startButton} onClick={handleStartGame}>Start Game</button>
      )}
    </div>
  );
}
