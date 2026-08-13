import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global Emergency Stop on App Launch
if (typeof window !== 'undefined') {
  const silenceAll = () => {
    document.querySelectorAll<HTMLMediaElement>('audio, video').forEach((m) => {
      try {
        m.pause();
        m.currentTime = 0;
        m.muted = true;
      } catch (e) {
        // Ignore
      }
    });
  };

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', silenceAll);
  } else {
    silenceAll();
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

