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
import { useCall } from '../context/CallContext';

interface WebRTCCallModalProps {
  callState: CallState | null;
  onEndCall: () => void;
}

export const WebRTCCallModal: React.FC<WebRTCCallModalProps> = ({ callState, onEndCall }) => {
  const { t } = useTheme();
  const { localStream, remoteStream, switchCamera } = useCall();

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Attach the local stream (owned by CallContext) to the preview element
  useEffect(() => {
    if (localVideoRef.current && localStream && callState?.type === 'video') {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, callState?.type]);

  // Attach the remote stream when the other side's media arrives
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    // Timer for active call duration
    let timer: any = null;
    if (callState?.status === 'connected') {
      timer = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [callState?.status]);

  const handleToggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = isMuted; // Toggle track
      });
    }
    setIsMuted(!isMuted);
  };

  const handleToggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = isVideoOff; // Toggle track
      });
    }
    setIsVideoOff(!isVideoOff);
  };

  const handleEndCallClick = () => {
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
    <div className="fixed inset-0 z-50 bg-black animate-fade-in overflow-hidden">
      {/* ===== Full-screen stage ===== */}
      <div className="absolute inset-0">
        {callState.type === 'video' && !isVideoOff ? (
          remoteStream ? (
            <video
              ref={remoteVideoRef}
              data-user-initiated="true"
              autoPlay
              playsInline
              className="w-full h-full object-cover bg-black"
            />
          ) : (
            <div className="w-full h-full bg-stone-950 flex flex-col items-center justify-center gap-3">
              <img
                src={callState.partnerAvatar || 'https://orthodoxconnect.live/launchericon-512x512.png'}
                alt={callState.partnerName}
                className="w-24 h-24 rounded-full object-cover border-2 border-amber-400"
              />
              <span className="text-sm font-bold text-amber-200">
                {callState.partnerName}
              </span>
              <span className="text-xs text-stone-400 animate-pulse">
                {t('connecting') || 'Connecting video...'}
              </span>
            </div>
          )
        ) : (
          /* Audio Call / Video Off Placeholder */
          <div className="w-full h-full bg-stone-950 flex flex-col items-center justify-center text-center space-y-4 px-6">
            <div className="relative">
              <img
                src={callState.partnerAvatar || 'https://orthodoxconnect.live/launchericon-512x512.png'}
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

      {/* ===== Top overlay bar ===== */}
      <div className="absolute top-0 inset-x-0 z-10 bg-gradient-to-b from-black/80 via-black/40 to-transparent px-4 pt-4 pb-8">
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <div className="min-w-0">
              <div className="font-serif font-bold text-xs uppercase tracking-wider text-amber-200">
                {callState.status === 'connecting' || callState.status === 'calling'
                  ? t('calling')
                  : callState.status === 'ringing'
                  ? t('incomingCall')
                  : t('inCall')}
              </div>
              <div className="text-[11px] text-stone-300 truncate max-w-[45vw]">
                {callState.partnerName}
              </div>
            </div>
          </div>

          {callState.status === 'connected' && (
            <span className="px-3 py-1 rounded-full bg-black/60 border border-amber-900/40 text-amber-400 font-mono text-xs font-bold">
              {formatTimer(callDuration)}
            </span>
          )}

          <button
            onClick={handleEndCallClick}
            className="p-1.5 rounded-full text-stone-300 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ===== Local Video — picture-in-picture ===== */}
      {callState.type === 'video' && !isVideoOff && (
        <div className="absolute z-10 bottom-32 right-4 w-28 h-40 rounded-xl bg-stone-950/90 border-2 border-amber-500 shadow-2xl overflow-hidden">
          {localStream ? (
            <video
              ref={localVideoRef}
              data-user-initiated="true"
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-[9px] text-stone-400">...</span>
            </div>
          )}
        </div>
      )}

      {/* ===== Bottom overlay controls ===== */}
      <div className="absolute bottom-0 inset-x-0 z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 pt-10 pb-6">
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={handleToggleMute}
            className={`p-4 rounded-full transition-all cursor-pointer shadow-lg ${
              isMuted ? 'bg-red-600 text-white' : 'bg-stone-800/90 text-amber-300 hover:bg-stone-700'
            }`}
            title={isMuted ? t('unmuteMic') : t('muteMic')}
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>

          {callState.type === 'video' && (
            <button
              onClick={handleToggleVideo}
              className={`p-4 rounded-full transition-all cursor-pointer shadow-lg ${
                isVideoOff ? 'bg-red-600 text-white' : 'bg-stone-800/90 text-amber-300 hover:bg-stone-700'
              }`}
              title={isVideoOff ? t('cameraOn') : t('cameraOff')}
            >
              {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
            </button>
          )}

          {callState.type === 'video' && !isVideoOff && (
            <button
              onClick={() => switchCamera()}
              className="p-4 rounded-full transition-all cursor-pointer shadow-lg bg-stone-800/90 text-amber-300 hover:bg-stone-700"
              title={t('switchCamera') || 'Switch camera'}
            >
              <SwitchCamera className="w-6 h-6" />
            </button>
          )}

          <button
            onClick={() => setIsSpeakerMuted(!isSpeakerMuted)}
            className={`p-4 rounded-full transition-all cursor-pointer shadow-lg ${
              isSpeakerMuted ? 'bg-red-600 text-white' : 'bg-stone-800/90 text-amber-300 hover:bg-stone-700'
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
