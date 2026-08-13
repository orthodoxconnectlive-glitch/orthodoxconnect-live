import React, { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, MessageSquare, Shield, CheckCircle } from 'lucide-react';
import { addNotification } from '../utils/notifications';
import { useAuth } from '../context/AuthContext';

export interface ChatMessage {
  id: string;
  author: string;
  role?: string;
  text: string;
  timestamp: string;
  isBlessingRequest?: boolean;
  avatarUrl?: string;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-1',
    author: 'Deacon Andrew',
    role: 'clergy',
    text: 'Welcome beloved parishioners to today’s Divine Service! Grace and peace to all.',
    timestamp: '10:00 AM',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150',
  },
  {
    id: 'msg-2',
    author: 'Eleni Papadopoulos',
    role: 'member',
    text: 'Lord Have Mercy 🙏 Blessed feast day to all!',
    timestamp: '10:02 AM',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=150',
  },
  {
    id: 'msg-3',
    author: 'Subdeacon Mark',
    role: 'clergy',
    text: 'Please remember in your prayers the health and salvation of the servant of God, Thomas.',
    timestamp: '10:05 AM',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150',
  },
  {
    id: 'msg-4',
    author: 'Maria K.',
    role: 'member',
    text: 'Amen! The choir sounds beautiful today 🕯️',
    timestamp: '10:08 AM',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=150',
  },
];

interface ParishLiveChatProps {
  parishName?: string;
}

export const ParishLiveChat: React.FC<ParishLiveChatProps> = ({ parishName }) => {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll chat to bottom on new messages
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSendMessage = (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();

    const textToSend = (customText || inputText).trim();
    if (!textToSend) return;

    const authorName = profile?.full_name || profile?.username || 'Parish Member';

    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      author: authorName,
      role: profile?.role || 'member',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      avatarUrl: profile?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150',
    };

    setMessages((prev) => [...prev, newMessage]);
    if (!customText) setInputText('');
  };

  const handleRequestBlessing = () => {
    const authorName = profile?.full_name || profile?.username || 'Parish Member';

    const blessingMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      author: authorName,
      role: profile?.role || 'member',
      text: '🙏 Requesting priest’s blessing for family & health.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isBlessingRequest: true,
      avatarUrl: profile?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150',
    };

    setMessages((prev) => [...prev, blessingMessage]);
    addNotification({
      userId: 'all',
      type: 'system',
      title: `Blessing Request from ${authorName}`,
      body: 'Requesting priest’s blessing for family & health.',
      senderName: authorName,
      senderAvatar: profile?.avatar_url,
      link: 'live',
    });
    showToast('Blessing request submitted to priest!');
  };

  return (
    <div className="flex flex-col h-[520px] bg-stone-950 border border-amber-900/40 rounded-2xl shadow-2xl overflow-hidden relative">
      {/* Toast Overlay */}
      {toastMessage && (
        <div className="absolute top-12 left-4 right-4 z-30 p-2.5 rounded-xl bg-[#1c1611] border border-amber-500 text-amber-200 text-xs font-serif font-bold shadow-2xl flex items-center gap-2 animate-bounce">
          <CheckCircle className="w-4 h-4 text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Live Chat Header */}
      <div className="p-3.5 bg-stone-900/90 border-b border-amber-900/40 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-amber-400" />
          <h3 className="font-serif font-bold text-xs text-amber-100 uppercase tracking-wider">
            Parish Live Chat
          </h3>
          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold">
            LIVE FEED
          </span>
        </div>

        <button
          onClick={handleRequestBlessing}
          className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-sm"
          title="Send blessing request to clergy"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Request Blessing</span>
        </button>
      </div>

      {/* Messages Feed */}
      <div
        ref={chatContainerRef}
        className="flex-1 p-3.5 overflow-y-auto space-y-3 bg-stone-950/60 scrollbar-thin scrollbar-thumb-stone-800"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-2.5 p-2 rounded-xl transition-all ${
              msg.isBlessingRequest
                ? 'bg-amber-950/60 border border-amber-500/50 shadow-md'
                : 'hover:bg-stone-900/50'
            }`}
          >
            <img
              src={msg.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150'}
              alt={msg.author}
              className="w-6 h-6 rounded-full object-cover border border-amber-600/30 shrink-0 mt-0.5"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-xs text-amber-200">{msg.author}</span>
                {msg.role === 'clergy' && (
                  <span className="px-1.5 py-0.2 rounded bg-amber-600 text-stone-950 text-[9px] font-black uppercase flex items-center gap-0.5">
                    <Shield className="w-2.5 h-2.5" /> CLERGY
                  </span>
                )}
                <span className="text-[10px] text-stone-500 ml-auto">{msg.timestamp}</span>
              </div>
              <p
                className={`text-xs mt-0.5 break-words ${
                  msg.isBlessingRequest ? 'text-amber-300 font-serif font-bold' : 'text-stone-300'
                }`}
              >
                {msg.text}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Reaction Action Chips */}
      <div className="px-3 py-2 bg-stone-900/60 border-t border-amber-900/30 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
        <button
          onClick={() => handleSendMessage(undefined, 'Lord Have Mercy 🙏')}
          className="px-2.5 py-1 rounded-full bg-stone-800 hover:bg-stone-700 text-amber-300 text-[10px] font-semibold whitespace-nowrap transition-colors cursor-pointer"
        >
          🙏 Lord Have Mercy
        </button>
        <button
          onClick={() => handleSendMessage(undefined, '☦️ Amen')}
          className="px-2.5 py-1 rounded-full bg-stone-800 hover:bg-stone-700 text-amber-300 text-[10px] font-semibold whitespace-nowrap transition-colors cursor-pointer"
        >
          ☦️ Amen
        </button>
        <button
          onClick={() => handleSendMessage(undefined, '🕯️ Light a Candle')}
          className="px-2.5 py-1 rounded-full bg-stone-800 hover:bg-stone-700 text-amber-300 text-[10px] font-semibold whitespace-nowrap transition-colors cursor-pointer"
        >
          🕯️ Light a Candle
        </button>
        <button
          onClick={handleRequestBlessing}
          className="px-2.5 py-1 rounded-full bg-amber-900/40 hover:bg-amber-900/60 text-amber-200 border border-amber-500/30 text-[10px] font-semibold whitespace-nowrap transition-colors cursor-pointer"
        >
          ✝️ Request Blessing
        </button>
      </div>

      {/* Chat Input Field */}
      <form
        onSubmit={handleSendMessage}
        className="p-3 bg-stone-900 border-t border-amber-900/40 flex items-center gap-2 shrink-0"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={`Chat with ${parishName || 'parishioners'}...`}
          className="flex-1 px-3 py-2 rounded-xl bg-stone-950 border border-amber-900/40 text-xs text-amber-100 placeholder-stone-500 focus:outline-none focus:border-amber-500"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="p-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 disabled:opacity-40 transition-colors cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
