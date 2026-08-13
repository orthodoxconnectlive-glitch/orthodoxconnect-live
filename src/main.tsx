import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global Emergency Stop & Hard Autoplay Guard on HTMLMediaElement Prototype
if (typeof window !== 'undefined') {
  // Force initial muted default on prototype level & block autoplay unless explicitly triggered
  HTMLMediaElement.prototype.play = (function (originalPlay) {
    return function (this: HTMLMediaElement) {
      // Block automatic playback unless explicitly triggered by user interaction
      if (!this.dataset.userInitiated) {
        this.pause();
        return Promise.resolve();
      }
      return originalPlay.apply(this);
    };
  })(HTMLMediaElement.prototype.play);

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

