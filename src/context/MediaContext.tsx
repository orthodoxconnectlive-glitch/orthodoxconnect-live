import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface MediaContextType {
  activeMediaId: string | null;
  setActiveMediaId: (id: string | null) => void;
  pauseAllMedia: (exceptElement?: HTMLMediaElement | null) => void;
  isGlobalMuted: boolean;
  setIsGlobalMuted: (muted: boolean) => void;
  toggleGlobalMute: () => void;
}

const GLOBAL_MUTED_STORAGE_KEY = 'orthodox_video_global_muted_v1';

const MediaContext = createContext<MediaContextType>({
  activeMediaId: null,
  setActiveMediaId: () => {},
  pauseAllMedia: () => {},
  isGlobalMuted: true,
  setIsGlobalMuted: () => {},
  toggleGlobalMute: () => {},
});

export const MediaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeMediaId, setActiveMediaId] = useState<string | null>(null);
  const [isGlobalMuted, setIsGlobalMutedState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(GLOBAL_MUTED_STORAGE_KEY);
      if (saved !== null) {
        return saved === 'true';
      }
    } catch (e) {
      // ignore
    }
    return true; // Default muted for mobile autoplay compliance
  });

  const setIsGlobalMuted = useCallback((muted: boolean) => {
    setIsGlobalMutedState(muted);
    try {
      localStorage.setItem(GLOBAL_MUTED_STORAGE_KEY, String(muted));
    } catch (e) {
      // ignore
    }

    // Immediately propagate the mute state to all currently mounted video and audio elements
    const mediaElements = document.querySelectorAll<HTMLMediaElement>('video, audio');
    mediaElements.forEach((media) => {
      media.muted = muted;
    });
  }, []);

  const toggleGlobalMute = useCallback(() => {
    setIsGlobalMutedState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(GLOBAL_MUTED_STORAGE_KEY, String(next));
      } catch (e) {
        // ignore
      }
      const mediaElements = document.querySelectorAll<HTMLMediaElement>('video, audio');
      mediaElements.forEach((media) => {
        media.muted = next;
      });
      return next;
    });
  }, []);

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
    <MediaContext.Provider
      value={{
        activeMediaId,
        setActiveMediaId,
        pauseAllMedia,
        isGlobalMuted,
        setIsGlobalMuted,
        toggleGlobalMute,
      }}
    >
      {children}
    </MediaContext.Provider>
  );
};

export const useMedia = () => useContext(MediaContext);
