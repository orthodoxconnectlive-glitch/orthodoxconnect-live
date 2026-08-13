import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  SwitchCamera,
  Sparkles,
} from 'lucide-react';
import { CallState } from '../types';
import { useTheme } from '../context/ThemeContext';

interface WebRTCCallModalProps {
  callState: CallState | null;
  onEndCall: () => void;
}

export const WebRTCCallModal: React.FC<WebRTCCallModalProps> = ({ callState, onEndCall }) => {
  const { t } = useTheme();

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!callState || callState.status === 'idle' || callState.status === 'ended') {
      stopLocalStream();
      return;
    }

    // Start local media stream for WebRTC
    startLocalStream();

    // Timer for active call duration
    let timer: any = null;
    if (callState.status === 'connected') {
      timer = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [callState?.status, callState?.type]);

  const startLocalStream = async () => {
    try {
      const constraints = {
        audio: true,
        video: callState?.type === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;

      if (localVideoRef.current && callState?.type === 'video') {
        localVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn('Media devices access fallback:', err);
    }
  };

  const stopLocalStream = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
  };

  const handleToggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = isMuted; // Toggle track
      });
    }
    setIsMuted(!isMuted);
  };

  const handleToggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = isVideoOff; // Toggle track
      });
    }
    setIsVideoOff(!isVideoOff);
  };

  const handleEndCallClick = () => {
    stopLocalStream();
    onEndCall();
  };

  if (!callState || callState.status === 'idle' || callState.status === 'ended') {
    return null;
  }

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-lg animate-fade-in">
      <div className="relative w-full max-w-2xl bg-stone-950 border-2 border-amber-600/50 rounded-3xl p-6 shadow-2xl text-stone-100 flex flex-col items-center justify-between min-h-[480px]">
        {/* Top Bar */}
        <div className="w-full flex items-center justify-between pb-4 border-b border-amber-900/40">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-serif font-bold text-xs uppercase tracking-wider text-amber-200">
              {callState.status === 'connecting' || callState.status === 'calling'
                ? t('calling')
                : callState.status === 'ringing'
                ? t('incomingCall')
                : t('inCall')}
            </span>
          </div>

          {callState.status === 'connected' && (
            <span className="px-3 py-1 rounded-full bg-stone-900 border border-amber-900/40 text-amber-400 font-mono text-xs font-bold">
              {formatTimer(callDuration)}
            </span>
          )}

          <button
            onClick={handleEndCallClick}
            className="p-1.5 rounded-full text-stone-400 hover:text-white hover:bg-stone-900 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Center Stage */}
        <div className="w-full flex-1 my-6 flex flex-col items-center justify-center relative rounded-2xl bg-stone-900/80 border border-amber-900/30 overflow-hidden p-6">
          {callState.type === 'video' && !isVideoOff ? (
            <div className="relative w-full h-full min-h-[280px] flex items-center justify-center">
              {/* Local Video Stream */}
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full max-h-[300px] object-cover rounded-2xl border-2 border-amber-500/40 shadow-inner bg-black"
              />

              {/* Remote Stream Overlay / Partner Avatar */}
              <div className="absolute bottom-3 right-3 w-28 h-20 rounded-xl bg-stone-950/90 border-2 border-amber-500 shadow-2xl overflow-hidden flex flex-col items-center justify-center p-1">
                <img
                  src={callState.partnerAvatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200'}
                  alt={callState.partnerName}
                  className="w-8 h-8 rounded-full object-cover mb-1 border border-amber-400"
                />
                <span className="text-[9px] font-bold text-amber-200 truncate max-w-full">
                  {callState.partnerName}
                </span>
              </div>
            </div>
          ) : (
            /* Audio Call / Video Off Placeholder */
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="relative">
                <img
                  src={callState.partnerAvatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200'}
                  alt={callState.partnerName}
                  className="w-28 h-28 rounded-full object-cover border-4 border-amber-500 shadow-2xl"
                />
                <span className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-stone-950 flex items-center justify-center text-white text-[10px]">
                  ✓
                </span>
              </div>

              <div>
                <h3 className="font-serif font-bold text-xl text-amber-100">
                  {callState.partnerName}
                </h3>
                <p className="text-xs text-amber-400/80 font-serif">
                  {callState.type === 'video' ? 'Video Call (Camera Off)' : 'Orthodox 1-on-1 Voice Call'}
                </p>
              </div>

              {/* Audio Wave Simulation */}
              <div className="flex items-center gap-1.5 h-8">
                <span className="w-1.5 bg-amber-500 rounded-full animate-bounce h-4" />
                <span className="w-1.5 bg-amber-400 rounded-full animate-bounce h-7" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 bg-amber-500 rounded-full animate-bounce h-5" style={{ animationDelay: '300ms' }} />
                <span className="w-1.5 bg-amber-400 rounded-full animate-bounce h-8" style={{ animationDelay: '450ms' }} />
                <span className="w-1.5 bg-amber-500 rounded-full animate-bounce h-4" style={{ animationDelay: '200ms' }} />
              </div>
            </div>
          )}
        </div>

        {/* Bottom Call Control Action Bar */}
        <div className="flex items-center justify-center gap-4 pt-2">
          <button
            onClick={handleToggleMute}
            className={`p-4 rounded-full transition-all cursor-pointer shadow-lg ${
              isMuted ? 'bg-red-600 text-white' : 'bg-stone-800 text-amber-300 hover:bg-stone-700'
            }`}
            title={isMuted ? t('unmuteMic') : t('muteMic')}
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>

          {callState.type === 'video' && (
            <button
              onClick={handleToggleVideo}
              className={`p-4 rounded-full transition-all cursor-pointer shadow-lg ${
                isVideoOff ? 'bg-red-600 text-white' : 'bg-stone-800 text-amber-300 hover:bg-stone-700'
              }`}
              title={isVideoOff ? t('cameraOn') : t('cameraOff')}
            >
              {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
            </button>
          )}

          <button
            onClick={() => setIsSpeakerMuted(!isSpeakerMuted)}
            className={`p-4 rounded-full transition-all cursor-pointer shadow-lg ${
              isSpeakerMuted ? 'bg-red-600 text-white' : 'bg-stone-800 text-amber-300 hover:bg-stone-700'
            }`}
          >
            {isSpeakerMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
          </button>

          <button
            onClick={handleEndCallClick}
            className="p-4 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-2xl transition-all cursor-pointer hover:scale-105"
            title={t('endCall')}
          >
            <PhoneOff className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};
