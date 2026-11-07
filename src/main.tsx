import { StrictMode, Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Render safety net: without this, ANY render error anywhere in the tree
// kills the whole app into a blank white screen with no recovery and no
// message. The boundary turns that into a visible screen with a Reload
// button instead.
class AppErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: unknown) {
    console.error('[App] render error:', err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: '#0f0c09', color: '#f5ebd9', fontFamily: 'Georgia, serif', textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: '2rem', color: '#c5a059' }}>☨</div>
            <p style={{ fontWeight: 'bold', margin: '0.75rem 0 0.25rem' }}>OrthodoxConnect hit a snag loading.</p>
            <p style={{ opacity: 0.8, margin: '0 0 1rem', fontSize: '0.9rem' }}>Tap below to reload the app — your account is safe.</p>
            <button onClick={() => window.location.reload()} style={{ background: '#c5a059', color: '#0f0c09', border: 'none', borderRadius: '999px', padding: '0.75rem 1.5rem', fontWeight: 'bold', cursor: 'pointer' }}>Reload the app</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);

