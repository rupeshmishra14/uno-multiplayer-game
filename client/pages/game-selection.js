import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function GameSelection() {
  const [gameId, setGameId] = useState('');
  const [error, setError] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const username = localStorage.getItem('username');
    if (!username) {
      router.push('/');
    }
  }, [router]);

  const createGame = async () => {
    setError(null);
    const username = localStorage.getItem('username');
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/games`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      const data = await response.json();
      if (response.ok) {
        router.push(`/lobby/${data.gameId}`);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Failed to create game. Please try again.');
    }
  };

  const joinGame = async (e) => {
    e.preventDefault();
    setError(null);
    const username = localStorage.getItem('username');
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/games/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, username }),
      });
      if (response.ok) {
        router.push(`/lobby/${gameId}`);
      } else {
        const data = await response.json();
        setError(data.message);
      }
    } catch (err) {
      setError('Failed to join game. Please try again.');
    }
  };

  return (
    <div className="container">
      <h1>Game Selection</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <button onClick={createGame}>Create New Game</button>
      <form onSubmit={joinGame}>
        <input
          type="text"
          value={gameId}
          onChange={(e) => setGameId(e.target.value)}
          placeholder="Enter Game ID"
          required
        />
        <button type="submit">Join Game</button>
      </form>
    </div>
  );
}