import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import styles from '../../styles/GameOver.module.css';
import { resetGame } from '../../src/utils/socket';

export default function GameOver() {
  const router = useRouter();
  const { gameId } = router.query;
  const [winner, setWinner] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    const storedWinner = localStorage.getItem('winner');
    if (storedWinner) {
      setWinner(storedWinner);
    }
  }, []);

  const handlePlayAgain = async () => {
    try {
      await resetGame(gameId);
      router.push(`/lobby/${gameId}`);
    } catch (error) {
      console.error('Error resetting game:', error);
      setError('Failed to reset the game. Please try again.');
    }
  };

  const handleLeaveGame = () => {
    // Route to the game selection page instead of the root
    router.push('/game-selection');
  };

  return (
    <div className={styles.gameOverContainer}>
      <h1>Game Over</h1>
      <h2>{winner ? `${winner} wins!` : 'The game has ended.'}</h2>
      {error && <p className={styles.errorMessage}>{error}</p>}
      <div className={styles.buttonContainer}>
        <button onClick={handlePlayAgain} className={styles.playAgainButton}>Play Again</button>
        <button onClick={handleLeaveGame} className={styles.leaveGameButton}>Leave Game</button>
      </div>
    </div>
  );
}
