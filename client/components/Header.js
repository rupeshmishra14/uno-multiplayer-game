import { useRouter } from 'next/router';
import styles from '../styles/Header.module.css';

export default function Header() {
  const router = useRouter();
  const username = typeof window !== 'undefined' ? localStorage.getItem('username') : '';

  const handleExit = () => {
    localStorage.removeItem('username');
    router.push('/');
  };

  return (
    <header className={styles.header}>
      <div className={styles.leftSection}>
        <div className={styles.greeting}>Hello, {username}</div>
      </div>
      <h1 className={styles.title}>UNO GAME</h1>
      <div className={styles.rightSection}>
        <button className={styles.exitButton} onClick={handleExit}>EXIT</button>
      </div>
    </header>
  );
}
