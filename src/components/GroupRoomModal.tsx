import React, { useState } from 'react';
import {
  X,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Hand,
  Users,
  MessageSquare,
  Send,
} from 'lucide-react';
import { GroupRoom } from '../types';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

interface GroupRoomModalProps {
  room: GroupRoom | null;
  isOpen: boolean;
  onClose: () => void;
}

interface RoomChatMessage {
  sender: string;
  text: string;
  time: string;
}

export const GroupRoomModal: React.FC<GroupRoomModalProps> = ({ room, isOpen, onClose }) => {
  const { profile } = useAuth();
  const { t, language } = useTheme();

  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatList, setChatList] = useState<RoomChatMessage[]>([]);

  if (!isOpen || !room) return null;

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;

    setChatList((prev) => [
      ...prev,
      {
        sender: profile?.full_name || (language === 'ar' ? 'عضو الرعية' : 'Parishioner'),
        text: chatMessage.trim(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setChatMessage('');
  };

  // Mock participants
  const participants = [
    {
      name: room.hostName,
      role: language === 'ar' ? 'المستضيف' : 'Host',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
    },
    {
      name: profile?.full_name || (language === 'ar' ? 'أنت' : 'You'),
      role: language === 'ar' ? 'مشارك' : 'Participant',
      avatar: profile?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl bg-stone-950 border border-amber-600/40 rounded-2xl p-6 shadow-2xl text-stone-100 flex flex-col md:flex-row gap-6 max-h-[90vh] text-left rtl:text-right">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rtl:right-auto rtl:left-4 z-20 p-1.5 rounded-full text-stone-400 hover:text-amber-300 hover:bg-stone-900 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Left: Video Stage & Controls */}
        <div className="flex-1 flex flex-col space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-amber-900/40">
            <span className="text-2xl">{room.icon}</span>
            <div>
              <h3 className="font-serif font-bold text-lg text-amber-100">
                {room.name}
              </h3>
              <p className="text-xs text-stone-400 flex items-center gap-2">
                <span>
                  {language === 'ar' ? `استضافة ${room.hostName}` : `Hosted by ${room.hostName}`}
                </span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <Users className="w-3 h-3" /> {room.activeCount + 1} {t('activeMembers')}
                </span>
              </p>
            </div>
          </div>

          {/* Participant Grid */}
          <div className="flex-1 grid grid-cols-2 gap-3 min-h-[260px] bg-stone-900/90 rounded-2xl p-3 border border-amber-900/30 overflow-y-auto">
            {participants.map((p, idx) => (
              <div
                key={idx}
                className="relative aspect-video rounded-xl bg-stone-950 border border-amber-900/30 overflow-hidden flex flex-col items-center justify-center p-3 text-center group"
              >
                {isVideoOn || idx !== 1 ? (
                  <img
                    src={p.avatar}
                    alt={p.name}
                    className="w-16 h-16 rounded-full object-cover border-2 border-amber-500/40 mb-2 shadow-lg"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-stone-800 border-2 border-stone-700 flex items-center justify-center mb-2">
                    <VideoOff className="w-6 h-6 text-stone-500" />
                  </div>
                )}

                <span className="text-xs font-bold text-amber-100">{p.name}</span>
                <span className="text-[10px] text-amber-400/80">{p.role}</span>

                {idx === 1 && isHandRaised && (
                  <span className="absolute top-2 right-2 rtl:right-auto rtl:left-2 p-1 rounded-full bg-amber-500 text-stone-950 shadow-md">
                    <Hand className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Call Control Bar */}
          <div className="flex items-center justify-center gap-4 p-3 bg-stone-900 border border-amber-900/30 rounded-xl">
            <button
              onClick={() => setIsMicOn(!isMicOn)}
              className={`p-3 rounded-full transition-colors cursor-pointer ${
                isMicOn ? 'bg-stone-800 text-amber-300 hover:bg-stone-700' : 'bg-red-600 text-white'
              }`}
              title={isMicOn ? (language === 'ar' ? 'كتم الميكروفون' : 'Mute Mic') : (language === 'ar' ? 'تشغيل الميكروفون' : 'Unmute Mic')}
            >
              {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>

            <button
              onClick={() => setIsVideoOn(!isVideoOn)}
              className={`p-3 rounded-full transition-colors cursor-pointer ${
                isVideoOn ? 'bg-stone-800 text-amber-300 hover:bg-stone-700' : 'bg-red-600 text-white'
              }`}
              title={isVideoOn ? (language === 'ar' ? 'إيقاف الكاميرا' : 'Stop Video') : (language === 'ar' ? 'تشغيل الكاميرا' : 'Start Video')}
            >
              {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>

            <button
              onClick={() => setIsHandRaised(!isHandRaised)}
              className={`p-3 rounded-full transition-colors cursor-pointer ${
                isHandRaised ? 'bg-amber-500 text-stone-950' : 'bg-stone-800 text-amber-300 hover:bg-stone-700'
              }`}
              title={language === 'ar' ? 'رفع اليد' : 'Raise Hand'}
            >
              <Hand className="w-5 h-5" />
            </button>

            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-full cursor-pointer shadow-lg"
            >
              {language === 'ar' ? 'مغادرة الغرفة' : 'Leave Room'}
            </button>
          </div>
        </div>

        {/* Right: Live Room Chat */}
        <div className="w-full md:w-80 flex flex-col border-t md:border-t-0 md:border-l rtl:md:border-l-0 rtl:md:border-r border-amber-900/40 pt-4 md:pt-0 md:pl-4 rtl:md:pl-0 rtl:md:pr-4 min-h-[300px]">
          <h4 className="font-serif font-bold text-xs text-amber-300 mb-3 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-amber-400" />
            <span>{language === 'ar' ? 'دردشة الغرفة الروحية' : 'Room Fellowship Chat'}</span>
          </h4>

          <div className="flex-1 space-y-3 overflow-y-auto max-h-[280px] p-2 bg-stone-900/60 rounded-xl border border-amber-900/20 text-xs mb-3">
            {chatList.map((msg, idx) => (
              <div key={idx} className="space-y-0.5">
                <div className="flex items-center justify-between text-[10px] text-amber-400/80 font-bold">
                  <span>{msg.sender}</span>
                  <span className="text-stone-500">{msg.time}</span>
                </div>
                <p className="text-stone-200 bg-stone-950 p-2 rounded-lg border border-stone-800">
                  {msg.text}
                </p>
              </div>
            ))}
          </div>

          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              placeholder={language === 'ar' ? 'اكتب رسالة...' : 'Type message...'}
              className="flex-1 p-2 rounded-xl bg-stone-900 border border-amber-900/30 text-xs text-amber-100 focus:outline-none focus:border-amber-500"
            />
            <button
              type="submit"
              className="p-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold cursor-pointer"
            >
              <Send className="w-4 h-4 rtl:rotate-180" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
