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
          media.currentTime = 0;
        } catch (err) {
          console.warn('[MediaContext] Error pausing media element:', err);
        }
      }
    });
  }, []);

  // DOM Event Interceptor: Listen on document capture phase for 'play' events on any audio or video element
  useEffect(() => {
    const handleGlobalPlay = (e: Event) => {
      const target = e.target as HTMLMediaElement;
      if (!target || !(target instanceof HTMLMediaElement)) return;

      // Automatically pause and reset all other playing media elements across the DOM
      const mediaElements = document.querySelectorAll<HTMLMediaElement>('audio, video');
      mediaElements.forEach((media) => {
        if (media !== target) {
          try {
            if (!media.paused) {
              media.pause();
            }
            media.currentTime = 0;
          } catch (err) {
            console.warn('[MediaContext] Error pausing inactive media element:', err);
          }
        }
      });

      // If the playing element has a dataset ID or source, track it as active media
      const mediaId = target.dataset.mediaId || target.id || target.src || null;
      setActiveMediaId(mediaId);
    };

    // 'play' event does not bubble, so we must use capture = true
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
