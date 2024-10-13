import { useState, useEffect } from 'react';
import '../styles/globals.css'
import Header from '../components/Header'

function MyApp({ Component, pageProps }) {
  const [username, setUsername] = useState('');

  useEffect(() => {
    setUsername(localStorage.getItem('username') || '');
  }, []);

  return (
    <div className="app-container">
      {username && <Header />}
      <Component {...pageProps} setUsername={setUsername} />
    </div>
  )
}

export default MyApp