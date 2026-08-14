import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface MediaContextType {
  activeMediaId: string | null;
  setActiveMediaId: (id: string | null) => void;
  pauseAllMedia: (exceptElement?: HTMLMediaElement | null) => void;
}

const MediaContext = createContext<MediaContextType>({
  activeMediaId: null,
  setActiveMediaId: () => {},
  pauseAllMedia: () => {},
});

export const MediaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeMediaId, setActiveMediaId] = useState<string | null>(null);

  // Pause all audio and video elements on the page except optionally one element
  const pauseAllMedia = useCallback((exceptElement?: HTMLMediaElement | null) => {
    const mediaElements = document.querySelectorAll<HTMLMediaElement>('audio, video');
    mediaElements.forEach((media) => {
      if (media !== exceptElement) {
        try {
          if (!media.paused) {
            media.pause();
          }
          // REMOVED media.currentTime = 0; -> Setting currentTime = 0 purges mobile video buffers!
        } catch (err) {
          console.warn('[MediaContext] Error pausing media element:', err);
        }
      }
    });
  }, []);

  // DOM Event Interceptor: Listen on document capture phase for 'play' events
  useEffect(() => {
    const handleGlobalPlay = (e: Event) => {
      const target = e.target as HTMLMediaElement;
      if (!target || !(target instanceof HTMLMediaElement)) return;

      // Safely pause all other playing media elements WITHOUT resetting buffer position
      const mediaElements = document.querySelectorAll<HTMLMediaElement>('audio, video');
      mediaElements.forEach((media) => {
        if (media !== target) {
          try {
            if (!media.paused) {
              media.pause();
            }
          } catch (err) {
            console.warn('[MediaContext] Error pausing inactive media element:', err);
          }
        }
      });

      const mediaId = target.dataset.mediaId || target.id || target.src || null;
      setActiveMediaId(mediaId);
    };

    // 'play' event does not bubble, so capture phase (true) is required
    document.addEventListener('play', handleGlobalPlay, true);

    return () => {
      document.removeEventListener('play', handleGlobalPlay, true);
    };
  }, []);

  return (
    <MediaContext.Provider value={{ activeMediaId, setActiveMediaId, pauseAllMedia }}>
      {children}
    </MediaContext.Provider>
  );
};

export const useMedia = () => useContext(MediaContext);
