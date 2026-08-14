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

  window.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll<HTMLMediaElement>('audio, video').forEach((media) => {
      media.pause();
      media.muted = true;
    });
  });

  // Also execute immediately in case DOM is already interactive/complete
  if (document.readyState !== 'loading') {
    document.querySelectorAll<HTMLMediaElement>('audio, video').forEach((media) => {
      media.pause();
      media.muted = true;
    });
  }

  // Register Service Worker for background notifications and ringing
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[SW] Service Worker registered for notifications & calls:', reg.scope);
        })
        .catch((err) => {
          console.warn('[SW] Service Worker registration fallback:', err);
        });
    });
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

