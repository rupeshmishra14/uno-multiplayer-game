import { useState } from 'react';
import { useRouter } from 'next/router';

export default function Home({ setUsername }) {
  const [inputUsername, setInputUsername] = useState('');
  const router = useRouter();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputUsername.trim()) {
      localStorage.setItem('username', inputUsername);
      setUsername(inputUsername);
      router.push('/game-selection');
    }
  };

  return (
    <div className="container">
      <h1>Welcome to UNO</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={inputUsername}
          onChange={(e) => setInputUsername(e.target.value)}
          placeholder="Enter your username"
          required
        />
        <button type="submit">Enter Game</button>
      </form>
    </div>
  );
}