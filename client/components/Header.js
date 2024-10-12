import { useRouter } from 'next/router';

export default function Header() {
  const router = useRouter();
  const username = typeof window !== 'undefined' ? localStorage.getItem('username') : '';

  const handleExit = () => {
    localStorage.removeItem('username');
    router.push('/');
  };

  return (
    <header>
      <h2>Hello, {username}</h2>
      <button onClick={handleExit}>Exit</button>
    </header>
  );
}