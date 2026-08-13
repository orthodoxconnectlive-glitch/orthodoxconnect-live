import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Music, Disc } from 'lucide-react';
import { useMedia } from '../context/MediaContext';

interface AudioPlayerProps {
  audioUrl: string;
  title?: string;
  authorName?: string;
  duration?: number;
  mediaId?: string;
  className?: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioUrl,
  title = 'Liturgical Audio / Chant',
  authorName,
  duration,
  mediaId,
  className = '',
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [totalDuration, setTotalDuration] = useState<number>(duration || 0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(1);
  const { pauseAllMedia, setActiveMediaId } = useMedia();

  const elementMediaId = mediaId || `audio-${audioUrl}`;

  // Keep state synchronized with native audio events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => {
      setIsPlaying(true);
      setActiveMediaId(elementMediaId);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setTotalDuration(audio.duration);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [elementMediaId, setActiveMediaId]);

  // Handle explicit Play / Pause user tap
  const handleTogglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      // Pause all other playing media across the feed and app
      pauseAllMedia(audio);
      setActiveMediaId(elementMediaId);
      audio.play().catch((err) => {
        console.warn('[AudioPlayer] Playback was prevented:', err);
      });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const handleToggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    audioRef.current.muted = nextMuted;
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    if (audioRef.current) {
      audioRef.current.volume = newVol;
      audioRef.current.muted = newVol === 0;
      setIsMuted(newVol === 0);
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || !isFinite(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div
      id={elementMediaId}
      className={`rounded-2xl p-3.5 bg-gradient-to-r from-[#2c1d11] via-[#3d2b18] to-[#2c1d11] border border-[#c5a059]/40 shadow-lg text-[#f5ebd9] ${className}`}
    >
      {/* Native HTML5 Audio Tag: AutoPlay explicitly disabled, Preload none */}
      <audio
        ref={audioRef}
        data-media-id={elementMediaId}
        src={audioUrl}
        autoPlay={false}
        preload="none"
        muted={isMuted}
      />

      <div className="flex items-center gap-3.5">
        {/* Explicit Play / Pause Button with Orthodox Gold Theme */}
        <button
          type="button"
          onClick={handleTogglePlay}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all transform hover:scale-105 active:scale-95 shadow-md cursor-pointer shrink-0 border ${
            isPlaying
              ? 'bg-gradient-to-br from-[#c5a059] to-[#8f6e30] text-[#1c130c] border-[#f5ebd9]'
              : 'bg-gradient-to-br from-[#8f6e30] to-[#5a4220] hover:from-[#c5a059] hover:to-[#8f6e30] text-[#f5ebd9] border-[#c5a059]/60'
          }`}
          title={isPlaying ? 'Pause Audio' : 'Play Audio'}
          aria-label={isPlaying ? 'Pause Audio' : 'Play Audio'}
        >
          {isPlaying ? (
            <Pause className="w-5 h-5 fill-current" />
          ) : (
            <Play className="w-5 h-5 fill-current ml-0.5" />
          )}
        </button>

        {/* Track Details & Visualizer Bar */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <Music className={`w-3.5 h-3.5 text-[#c5a059] shrink-0 ${isPlaying ? 'animate-bounce' : ''}`} />
              <span className="text-xs font-serif font-bold text-[#f5ebd9] truncate">
                {title}
              </span>
            </div>
            {authorName && (
              <span className="text-[10px] text-[#c5a059] font-serif uppercase tracking-wider shrink-0">
                {authorName}
              </span>
            )}
          </div>

          {/* Scrubbable Progress Bar */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-[#eedcb5]/80 w-8 text-right">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={totalDuration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 h-1.5 bg-[#1c130c] rounded-lg appearance-none cursor-pointer accent-[#c5a059]"
              title="Seek audio track"
            />
            <span className="text-[10px] font-mono text-[#eedcb5]/80 w-8">
              {formatTime(totalDuration)}
            </span>
          </div>
        </div>

        {/* Volume / Mute Control */}
        <div className="hidden sm:flex items-center gap-1.5 pl-2 border-l border-[#c5a059]/20 shrink-0">
          <button
            type="button"
            onClick={handleToggleMute}
            className="p-1 text-[#eedcb5]/80 hover:text-[#c5a059] transition-colors cursor-pointer"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-red-400" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-14 h-1 bg-[#1c130c] rounded-lg appearance-none cursor-pointer accent-[#c5a059]"
            title="Adjust volume"
          />
        </div>
      </div>
    </div>
  );
};
