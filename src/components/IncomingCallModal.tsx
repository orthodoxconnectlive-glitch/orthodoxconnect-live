import React, { useEffect } from 'react';
import { Phone, PhoneOff, Video, Mic, Church } from 'lucide-react';
import { CallState } from '../types';
import { useTheme } from '../context/ThemeContext';

interface IncomingCallModalProps {
  callState: CallState;
  onAccept: () => void;
  onDecline: () => void;
}

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  callState,
  onAccept,
  onDecline,
}) => {
  const { t } = useTheme();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-sm bg-gradient-to-b from-[#2d1e12] via-[#1c130c] to-[#120b06] border-2 border-[#c5a059] rounded-3xl p-6 shadow-2xl text-[#f5ebd9] flex flex-col items-center justify-between text-center overflow-hidden">
        {/* Animated pulsating background ring */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
          <div className="w-64 h-64 rounded-full border-4 border-[#c5a059] animate-ping" />
          <div className="absolute w-80 h-80 rounded-full border-2 border-[#c5a059] animate-pulse" />
        </div>

        {/* Top Status Header */}
        <div className="w-full flex items-center justify-center gap-2 pb-3 border-b border-[#c5a059]/30 z-10">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          <span className="font-serif font-bold text-xs uppercase tracking-widest text-[#c5a059]">
            {callState.type === 'video' ? 'Incoming Video Call' : 'Incoming Voice Call'}
          </span>
        </div>

        {/* Caller Avatar & Info */}
        <div className="my-6 flex flex-col items-center space-y-3 z-10">
          <div className="relative">
            <div className="w-28 h-28 rounded-full p-1 border-4 border-[#c5a059] shadow-2xl bg-[#3d2b18] overflow-hidden">
              <img
                src={
                  callState.partnerAvatar ||
                  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200'
                }
                alt={callState.partnerName}
                className="w-full h-full object-cover rounded-full"
              />
            </div>
            <div className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-emerald-600 border-2 border-[#1c130c] flex items-center justify-center text-white shadow-lg">
              {callState.type === 'video' ? (
                <Video className="w-4 h-4" />
              ) : (
                <Phone className="w-4 h-4" />
              )}
            </div>
          </div>

          <div>
            <h3 className="font-serif font-bold text-xl text-[#f5ebd9] tracking-wide">
              {callState.partnerName}
            </h3>
            <div className="flex items-center justify-center gap-1 mt-1 text-[#c5a059] text-xs font-serif">
              <Church className="w-3.5 h-3.5" />
              <span>Orthodox Parishioner</span>
            </div>
          </div>

          {/* Ringing Visualizer */}
          <div className="flex items-center gap-1.5 h-6 pt-2">
            <span className="w-1.5 bg-[#c5a059] rounded-full animate-bounce h-3" />
            <span className="w-1.5 bg-[#eedcb5] rounded-full animate-bounce h-6" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 bg-[#c5a059] rounded-full animate-bounce h-4" style={{ animationDelay: '300ms' }} />
            <span className="w-1.5 bg-[#eedcb5] rounded-full animate-bounce h-7" style={{ animationDelay: '450ms' }} />
            <span className="w-1.5 bg-[#c5a059] rounded-full animate-bounce h-3" style={{ animationDelay: '200ms' }} />
          </div>
        </div>

        {/* Action Buttons: Decline (Red) and Accept (Green) */}
        <div className="w-full flex items-center justify-around pt-4 border-t border-[#c5a059]/30 z-10">
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={onDecline}
              className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-2xl transition-transform hover:scale-110 active:scale-95 cursor-pointer"
              title="Decline Call"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
            <span className="text-[11px] font-serif text-red-300 font-semibold">Decline</span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={onAccept}
              className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-2xl transition-transform hover:scale-110 active:scale-95 cursor-pointer animate-pulse"
              title="Accept Call"
            >
              {callState.type === 'video' ? (
                <Video className="w-6 h-6" />
              ) : (
                <Phone className="w-6 h-6" />
              )}
            </button>
            <span className="text-[11px] font-serif text-emerald-300 font-semibold">Accept</span>
          </div>
        </div>
      </div>
    </div>
  );
};
