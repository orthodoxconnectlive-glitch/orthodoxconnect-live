import React, { useEffect, useRef } from 'react';
import {
  X,
  Mic,
  MicOff,
  Video,
  VideoOff,
  SwitchCamera,
  PhoneOff,
  Circle,
  Square,
  Users,
} from 'lucide-react';
import { useGroupCall } from '../context/GroupCallContext';
import { useTheme } from '../context/ThemeContext';

const ParticipantTile: React.FC<{
  userId: string;
  name: string;
  avatar?: string;
  stream: MediaStream | null;
  isMe: boolean;
  videoOff: boolean;
  muted: boolean;
}> = ({ userId, name, avatar, stream, isMe, videoOff, muted }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { registerVideoEl } = useGroupCall();

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    registerVideoEl(isMe ? 'me' : userId, videoRef.current);
    return () => registerVideoEl(isMe ? 'me' : userId, null);
  }, [userId, isMe, registerVideoEl]);

  const showVideo = stream && !videoOff;

  return (
    <div className="relative rounded-2xl overflow-hidden bg-stone-900 border border-amber-900/40 min-h-[160px] flex items-center justify-center">
      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isMe}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center gap-2 p-4">
          <img
            src={avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200'}
            alt={name}
            className="w-16 h-16 rounded-full object-cover border-2 border-amber-500"
          />
          <span className="text-xs font-bold text-amber-100 text-center">{name}</span>
        </div>
      )}

      {/* Name tag */}
      <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-[10px] font-bold text-amber-100 truncate max-w-[70%]">
        {name}
      </div>

      {/* Status icons */}
      <div className="absolute top-2 right-2 flex gap-1">
        {muted && (
          <span className="p-1 rounded-full bg-red-600 text-white">
            <MicOff className="w-3 h-3" />
          </span>
        )}
        {videoOff && (
          <span className="p-1 rounded-full bg-red-600 text-white">
            <VideoOff className="w-3 h-3" />
          </span>
        )}
      </div>
    </div>
  );
};

export const GroupCallModal: React.FC = () => {
  const {
    activeCall,
    participants,
    isMuted,
    isVideoOff,
    isRecording,
    recordingSecs,
    leaveCall,
    toggleMute,
    toggleVideo,
    switchCamera,
    startRecording,
    stopRecording,
  } = useGroupCall();
  const { t, language } = useTheme();

  if (!activeCall) return null;

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  const gridCols =
    participants.length <= 1 ? 'grid-cols-1' :
    participants.length <= 2 ? 'grid-cols-1 sm:grid-cols-2' :
    participants.length <= 4 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3';

  return (
    <div className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-lg flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-amber-900/40">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-amber-400" />
          <div>
            <h3 className="font-serif font-bold text-amber-100 text-sm">
              {activeCall.roomName}
            </h3>
            <p className="text-[10px] text-stone-400">
              {participants.length} {language === 'ar' ? 'مشارك' : 'participant'}{participants.length !== 1 ? (language === 'ar' ? 'ون' : 's') : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isRecording && (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600/20 border border-red-500 text-red-400 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              REC {fmtTime(recordingSecs)}
            </span>
          )}
          <button
            onClick={leaveCall}
            className="p-2 rounded-full text-stone-400 hover:text-white hover:bg-stone-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Video grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className={`grid ${gridCols} gap-3 max-w-5xl mx-auto`}>
          {participants.map((p) => (
            <ParticipantTile
              key={p.userId}
              userId={p.userId}
              name={p.name}
              avatar={p.avatar}
              stream={p.stream}
              isMe={p.isMe}
              videoOff={p.isMe && isVideoOff}
              muted={p.isMe && isMuted}
            />
          ))}
        </div>

        {participants.length <= 1 && (
          <p className="text-center text-stone-500 text-xs mt-6 animate-pulse">
            {language === 'ar'
              ? 'في انتظار انضمام الآخرين... شارك اسم الغرفة معهم'
              : 'Waiting for others to join... share the room with them'}
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 px-4 py-4 border-t border-amber-900/40 bg-stone-950/80">
        <button
          onClick={toggleMute}
          className={`p-4 rounded-full shadow-lg transition-all ${isMuted ? 'bg-red-600 text-white' : 'bg-stone-800 text-amber-300 hover:bg-stone-700'}`}
          title={isMuted ? t('unmuteMic') : t('muteMic')}
        >
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>

        <button
          onClick={toggleVideo}
          className={`p-4 rounded-full shadow-lg transition-all ${isVideoOff ? 'bg-red-600 text-white' : 'bg-stone-800 text-amber-300 hover:bg-stone-700'}`}
          title={isVideoOff ? t('cameraOn') : t('cameraOff')}
        >
          {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
        </button>

        {!isVideoOff && (
          <button
            onClick={() => switchCamera()}
            className="p-4 rounded-full shadow-lg bg-stone-800 text-amber-300 hover:bg-stone-700 transition-all"
            title={language === 'ar' ? 'تبديل الكاميرا' : 'Switch camera'}
          >
            <SwitchCamera className="w-6 h-6" />
          </button>
        )}

        <button
          onClick={() => (isRecording ? stopRecording() : startRecording())}
          className={`p-4 rounded-full shadow-lg transition-all ${isRecording ? 'bg-red-600 text-white animate-pulse' : 'bg-stone-800 text-amber-300 hover:bg-stone-700'}`}
          title={isRecording
            ? (language === 'ar' ? 'إيقاف التسجيل وحفظه' : 'Stop & save recording')
            : (language === 'ar' ? 'تسجيل الاجتماع' : 'Record meeting')}
        >
          {isRecording ? <Square className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
        </button>

        <button
          onClick={leaveCall}
          className="p-4 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-2xl transition-all hover:scale-105"
          title={t('endCall')}
        >
          <PhoneOff className="w-6 h-6" />
        </button>
      </div>

      {isRecording && (
        <p className="text-center text-[10px] text-red-400 pb-2">
          {language === 'ar'
            ? 'جارٍ التسجيل — سيُحفظ الفيديو على جهازك عند الإيقاف'
            : 'Recording — the video will save to your device when you stop'}
        </p>
      )}
    </div>
  );
};
