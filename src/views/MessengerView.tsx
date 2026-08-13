import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  Check,
  CheckCheck,
  Search,
  Phone,
  Video as VideoIcon,
  Image as ImageIcon,
  Mic,
  Paperclip,
  Film,
  X,
  Volume2,
  ThumbsUp,
  Smile,
  MoreHorizontal,
  Info,
  Plus,
  Bell,
  Palette,
  Heart,
  User,
  Shield,
  ChevronDown,
  ChevronRight,
  Sparkles,
  ArrowLeft,
  MessageCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { addNotification } from '../utils/notifications';
import { Message, CallState } from '../types';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { WebRTCCallModal } from '../components/WebRTCCallModal';
import { UserProfileData } from './ProfileView';
import { uploadMediaFile } from '../utils/storage';
import { TimeAgo } from '../components/TimeAgo';
import { formatTimeAgo } from '../utils/timeAgo';

interface ChatContact {
  id: string;
  name: string;
  full_name?: string;
  username?: string;
  parish: string;
  avatar: string;
  isOnline?: boolean;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
}

const CONTACTS: ChatContact[] = [];

function isUUIDString(str?: string | null): boolean {
  if (!str) return false;
  const clean = str.trim().replace(/^auth-/, '');
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(clean);
}

function getContactDisplayName(
  contact?: { full_name?: string; username?: string; name?: string; id?: string } | null
): string {
  if (!contact) return 'Parish Member';

  const fullName = contact.full_name?.trim();
  if (fullName && !isUUIDString(fullName)) return fullName;

  const username = contact.username?.trim();
  if (username && !isUUIDString(username)) return username;

  const name = contact.name?.trim();
  if (name && !isUUIDString(name) && !name.startsWith('auth-')) return name;

  return 'Parish Member';
}

function findContactInList(contacts: ChatContact[], searchId?: string): ChatContact | undefined {
  if (!searchId) return undefined;
  const normalized = searchId.toLowerCase().trim();

  return contacts.find(
    (c) =>
      c.id.toLowerCase() === normalized ||
      getContactDisplayName(c).toLowerCase() === normalized ||
      getContactDisplayName(c).toLowerCase().includes(normalized)
  );
}

const MESSENGER_THEMES = [
  { id: 'classic', name: 'Messenger Blue', gradient: 'bg-gradient-to-r from-blue-600 to-indigo-600', bubbleBg: 'bg-[#0084ff]' },
  { id: 'orthodox', name: 'Byzantine Gold', gradient: 'bg-gradient-to-r from-[#c5a059] to-[#a8833c]', bubbleBg: 'bg-[#a8833c]' },
  { id: 'berry', name: 'Grape Violet', gradient: 'bg-gradient-to-r from-purple-600 to-pink-600', bubbleBg: 'bg-purple-600' },
  { id: 'emerald', name: 'Emerald Forest', gradient: 'bg-gradient-to-r from-emerald-600 to-teal-600', bubbleBg: 'bg-emerald-600' },
  { id: 'sunset', name: 'Coral Sunset', gradient: 'bg-gradient-to-r from-rose-500 to-amber-500', bubbleBg: 'bg-rose-500' },
];

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '☦️'];

interface ExtendedMessage extends Message {
  reaction?: string;
}

interface MessengerViewProps {
  initialContactId?: string;
  onSelectUser?: (userData: UserProfileData) => void;
}

export const MessengerView: React.FC<MessengerViewProps> = ({ initialContactId, onSelectUser }) => {
  const { profile } = useAuth();
  const { t } = useTheme();

  const LOCAL_MESSAGES_KEY = 'orthodox_local_messages_v2';

  const loadLocalMessagesForContact = (contactId: string): ExtendedMessage[] => {
    try {
      const raw = localStorage.getItem(LOCAL_MESSAGES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed[contactId] && Array.isArray(parsed[contactId]) && parsed[contactId].length > 0) {
          return parsed[contactId];
        }
      }
    } catch (e) {
      console.warn('Local messages read error:', e);
    }
    return [];
  };

  const saveLocalMessagesForContact = (contactId: string, msgs: ExtendedMessage[]) => {
    try {
      const raw = localStorage.getItem(LOCAL_MESSAGES_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      parsed[contactId] = msgs;
      localStorage.setItem(LOCAL_MESSAGES_KEY, JSON.stringify(parsed));
    } catch (e) {
      console.warn('Local messages write error:', e);
    }
  };

  const [contactsList, setContactsList] = useState<ChatContact[]>(CONTACTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTheme, setActiveTheme] = useState(() => {
    try {
      const savedThemeName = localStorage.getItem('orthodox_messenger_theme');
      if (savedThemeName) {
        const match = MESSENGER_THEMES.find((t) => t.name === savedThemeName);
        if (match) return match;
      }
    } catch (e) {
      console.warn('Theme read error:', e);
    }
    return MESSENGER_THEMES[0];
  });
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [activeEmoji, setActiveEmoji] = useState('👍');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState<boolean>(!!initialContactId);

  const [activeContact, setActiveContact] = useState<ChatContact | null>(() => {
    const savedContactId = initialContactId || localStorage.getItem('orthodox_active_contact_id');
    if (savedContactId) {
      return {
        id: savedContactId,
        name: 'Parish Member',
        parish: 'Orthodox Fellowship',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
        isOnline: true,
      };
    }
    return null;
  });

  useEffect(() => {
    async function loadRealContacts() {
      try {
        // 1. Fetch profiles table with full_name and username
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, username, parish, avatar_url, is_ai, email')
          .neq('id', profile?.id || '')
          .order('created_at', { ascending: false });

        // 2. Fetch active messages to identify contacts user has chatted with
        const activePartnerIds = new Set<string>();
        if (profile?.id) {
          const { data: msgsData } = await supabase
            .from('messages')
            .select('sender_id, receiver_id, created_at')
            .or(`sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`)
            .order('created_at', { ascending: false });

          if (msgsData) {
            msgsData.forEach((m) => {
              const partnerId = m.sender_id === profile.id ? m.receiver_id : m.sender_id;
              if (partnerId && partnerId !== profile.id) {
                activePartnerIds.add(partnerId);
              }
            });
          }
        }

        if (!profilesError && profilesData) {
          const real = profilesData.filter((p) => !p.is_ai);
          const mapped: ChatContact[] = real.map((p) => {
            const displayName = getContactDisplayName(p);
            return {
              id: p.id,
              name: displayName,
              full_name: p.full_name || undefined,
              username: p.username || undefined,
              parish: p.parish || 'Orthodox Church',
              avatar: p.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
              isOnline: true,
              lastMessage: activePartnerIds.has(p.id) ? 'Active conversation' : 'Tap to chat',
            };
          });

          // Sort contacts so active conversation partners come first
          mapped.sort((a, b) => {
            const aHas = activePartnerIds.has(a.id) ? 1 : 0;
            const bHas = activePartnerIds.has(b.id) ? 1 : 0;
            return bHas - aHas;
          });

          setContactsList(mapped);

          if (mapped.length > 0) {
            setActiveContact((curr) => {
              if (!curr) return mapped[0];
              const found = mapped.find((m) => m.id === curr.id);
              if (found) return found;
              return {
                ...curr,
                name: getContactDisplayName(curr),
              };
            });
          }
        }
      } catch (err) {
        console.warn('Error loading real contacts in Messenger:', err);
      }
    }
    loadRealContacts();
  }, [profile?.id]);

  // Fetch individual profile details when activeContact has a raw UUID or default name
  useEffect(() => {
    if (!activeContact?.id) return;

    if (
      !activeContact.full_name &&
      !activeContact.username &&
      (isUUIDString(activeContact.name) || activeContact.name === 'Parish Member' || activeContact.name.startsWith('auth-'))
    ) {
      async function fetchSingleProfile() {
        try {
          const cleanId = activeContact!.id.replace(/^auth-/, '');
          const { data, error } = await supabase
            .from('profiles')
            .select('id, full_name, username, parish, avatar_url')
            .eq('id', cleanId)
            .maybeSingle();

          if (data && !error) {
            const realName = getContactDisplayName(data);
            setActiveContact((prev) =>
              prev && prev.id === activeContact!.id
                ? {
                    ...prev,
                    name: realName,
                    full_name: data.full_name || undefined,
                    username: data.username || undefined,
                    parish: data.parish || prev.parish,
                    avatar: data.avatar_url || prev.avatar,
                  }
                : prev
            );

            setContactsList((prevList) =>
              prevList.map((c) =>
                c.id === activeContact!.id
                  ? {
                      ...c,
                      name: realName,
                      full_name: data.full_name || undefined,
                      username: data.username || undefined,
                      parish: data.parish || c.parish,
                      avatar: data.avatar_url || c.avatar,
                    }
                  : c
              )
            );
          } else {
            setActiveContact((prev) => (prev ? { ...prev, name: getContactDisplayName(prev) } : null));
          }
        } catch (err) {
          console.warn('Profile fetch error for active contact:', err);
        }
      }
      fetchSingleProfile();
    }
  }, [activeContact?.id, activeContact?.name]);

  useEffect(() => {
    if (!initialContactId) return;

    setIsMobileChatOpen(true);

    setContactsList((prev) => {
      const match = findContactInList(prev, initialContactId);
      if (match) {
        setActiveContact(match);
        return prev;
      }

      const newContact: ChatContact = {
        id: initialContactId,
        name: 'Parish Member',
        parish: 'Orthodox Fellowship',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
        isOnline: true,
        lastMessage: 'Started a new conversation',
        lastMessageTime: 'Just now',
      };

      setActiveContact(newContact);
      const filtered = prev.filter((c) => c.id !== initialContactId);
      return [newContact, ...filtered];
    });
  }, [initialContactId]);

  const handleSelectContact = (contact: ChatContact) => {
    setActiveContact(contact);
    setIsMobileChatOpen(true);
    try {
      localStorage.setItem('orthodox_active_contact_id', contact.id);
    } catch (e) {
      console.warn('Active contact save error:', e);
    }
  };

  const handleBackToList = () => {
    setIsMobileChatOpen(false);
  };

  const [messages, setMessages] = useState<ExtendedMessage[]>(() =>
    activeContact ? loadLocalMessagesForContact(activeContact.id) : []
  );
  const [isMessagesLoading, setIsMessagesLoading] = useState<boolean>(true);

  const [inputContent, setInputContent] = useState(() => {
    try {
      return activeContact ? localStorage.getItem(`orthodox_messenger_draft_${activeContact.id}`) || '' : '';
    } catch (e) {
      return '';
    }
  });

  useEffect(() => {
    if (!activeContact) return;
    try {
      const draft = localStorage.getItem(`orthodox_messenger_draft_${activeContact.id}`) || '';
      setInputContent(draft);
    } catch (e) {
      setInputContent('');
    }
  }, [activeContact?.id]);

  const handleInputChange = (val: string) => {
    setInputContent(val);
    if (!activeContact) return;
    try {
      localStorage.setItem(`orthodox_messenger_draft_${activeContact.id}`, val);
    } catch (e) {
      console.warn('Draft error:', e);
    }
  };

  const [imageAttachment, setImageAttachment] = useState<string>('');
  const [videoAttachment, setVideoAttachment] = useState<string>('');
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);

  // Audio Voice Note Recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  // WebRTC Call state
  const [activeCall, setActiveCall] = useState<CallState | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeContact) {
      fetchMessages();
    } else {
      setMessages([]);
      setIsMessagesLoading(false);
    }
  }, [activeContact?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Real-time synchronization using Supabase Realtime channel and storage events
  useEffect(() => {
    if (!activeContact) return;
    const channel = supabase
      .channel(`messages_realtime_${activeContact.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          if (payload.new) {
            const newM = payload.new as ExtendedMessage;
            if (newM.sender_id === activeContact.id || newM.receiver_id === activeContact.id) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === newM.id)) return prev;
                const updated = [...prev, newM];
                saveLocalMessagesForContact(activeContact.id, updated);
                return updated;
              });
            }
          }
        }
      )
      .subscribe();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === LOCAL_MESSAGES_KEY) {
        setMessages(loadLocalMessagesForContact(activeContact.id));
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [activeContact?.id]);

  const fetchMessages = async () => {
    if (!activeContact) return;
    setIsMessagesLoading(true);
    const localMsgs = loadLocalMessagesForContact(activeContact.id);
    setMessages(localMsgs);

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${activeContact.id},receiver_id.eq.${activeContact.id}`)
        .order('created_at', { ascending: true });

      if (!error && data && data.length > 0) {
        // Merge Supabase messages with local messages
        const msgMap = new Map<string, ExtendedMessage>();
        localMsgs.forEach((m) => msgMap.set(m.id, m));
        data.forEach((m: any) => msgMap.set(m.id, m as ExtendedMessage));

        const merged = Array.from(msgMap.values()).sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );

        setMessages(merged);
        saveLocalMessagesForContact(activeContact.id, merged);
      }
    } catch (err) {
      console.warn('Supabase messages fallback:', err);
    } finally {
      setIsMessagesLoading(false);
    }
  };

  const handleSendMessage = async (customContent?: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeContact) return;
    const sendText = customContent !== undefined ? customContent : inputContent;
    if (!sendText.trim() && !imageAttachment && !videoAttachment) return;

    const newMsg: ExtendedMessage = {
      id: 'msg-' + Date.now(),
      sender_id: profile?.id || 'me',
      receiver_id: activeContact.id,
      content: sendText.trim(),
      image_url: imageAttachment || undefined,
      video_url: videoAttachment || undefined,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => {
      const updated = [...prev, newMsg];
      saveLocalMessagesForContact(activeContact.id, updated);
      return updated;
    });

    if (customContent === undefined) {
      setInputContent('');
      try {
        localStorage.removeItem(`orthodox_messenger_draft_${activeContact.id}`);
      } catch (err) {
        console.warn('Draft clear error:', err);
      }
    }
    setImageAttachment('');
    setVideoAttachment('');
    setShowEmojiPicker(false);

    // Update last message in contacts list snippet
    setContactsList((prev) =>
      prev.map((c) =>
        c.id === activeContact.id
          ? {
              ...c,
              lastMessage: sendText.trim() || 'Sent attachment',
              lastMessageTime: 'Just now',
            }
          : c
      )
    );

    try {
      await supabase.from('messages').insert([
        {
          sender_id: newMsg.sender_id,
          receiver_id: newMsg.receiver_id,
          content: newMsg.content,
          image_url: newMsg.image_url || null,
          video_url: newMsg.video_url || null,
        },
      ]);

      // Trigger notification for recipient
      addNotification({
        userId: activeContact.id || 'all',
        type: 'message',
        title: `Message from ${profile?.full_name || 'Parishioner'}`,
        body: sendText.trim() || 'Sent an attachment',
        senderName: profile?.full_name || 'Parishioner',
        senderAvatar: profile?.avatar_url,
        link: 'messages',
      });
    } catch (err) {
      console.warn('Message send warning:', err);
    }
  };

  const handleToggleReaction = (msgId: string, emoji: string) => {
    setMessages((prev) => {
      const updated = prev.map((m) =>
        m.id === msgId ? { ...m, reaction: m.reaction === emoji ? undefined : emoji } : m
      );
      saveLocalMessagesForContact(activeContact.id, updated);
      return updated;
    });
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = await uploadMediaFile(file, 'chat-media');
      setImageAttachment(url);
    }
    e.target.value = '';
  };

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = await uploadMediaFile(file, 'chat-media');
      setVideoAttachment(url);
    }
    e.target.value = '';
  };

  // Voice Note Recording handlers
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            sendAudioMessage(reader.result, recordingSeconds);
          }
        };
        reader.readAsDataURL(audioBlob);

        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      alert('Microphone permission required for audio voice notes.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
  };

  const sendAudioMessage = (audioUrl: string, duration: number) => {
    const newMsg: ExtendedMessage = {
      id: 'msg-audio-' + Date.now(),
      sender_id: profile?.id || 'me',
      receiver_id: activeContact.id,
      content: '🎙️ Voice Note (' + duration + 's)',
      audio_url: audioUrl,
      audio_duration: duration,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, newMsg]);
  };

  const handleStartCall = (type: 'audio' | 'video') => {
    setActiveCall({
      id: 'call-' + Date.now(),
      partnerId: activeContact.id,
      partnerName: activeContact.name,
      partnerAvatar: activeContact.avatar,
      type,
      status: 'calling',
      isMuted: false,
      isVideoOff: false,
    });

    setTimeout(() => {
      setActiveCall((prev) => (prev ? { ...prev, status: 'connected', startedAt: Date.now() } : null));
    }, 2000);
  };

  const activeContactsStories = contactsList.filter((c) => c.isOnline);

  return (
    <div className="bg-white dark:bg-[#18191a] text-gray-900 dark:text-gray-100 rounded-2xl md:rounded-3xl shadow-2xl border border-gray-200 dark:border-zinc-800 overflow-hidden flex flex-col md:flex-row h-[calc(100vh-6rem)] md:h-[700px] font-sans transition-colors">
      {/* Hidden File Picker Inputs */}
      <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
      <input ref={videoInputRef} type="file" accept="video/*" onChange={handleVideoSelect} className="hidden" />

      {/* 1. LEFT SIDEBAR - MESSENGER CHATS LIST (VIEW A ON MOBILE) */}
      <div
        className={`w-full md:w-80 lg:w-84 border-b md:border-b-0 md:border-r border-gray-200 dark:border-zinc-800 flex-col bg-white dark:bg-[#18191a] shrink-0 h-full ${
          isMobileChatOpen ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Left Header */}
        <div className="p-4 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={
                  profile?.avatar_url ||
                  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200'
                }
                alt={profile?.full_name || 'User'}
                className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-zinc-700 cursor-pointer hover:opacity-90"
              />
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-[#18191a]" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Chats</h2>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              className="p-2 rounded-full bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer text-gray-700 dark:text-gray-200"
              title="New Message"
            >
              <Sparkles className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messenger Search Input */}
        <div className="px-4 py-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search Messenger"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
            />
          </div>
        </div>

        {/* Active Stories Carousel (Active Now Row) */}
        <div className="px-4 py-2 overflow-x-auto no-scrollbar flex items-center gap-3 border-b border-gray-100 dark:border-zinc-800/60 pb-3">
          {/* Your Story */}
          <div className="flex flex-col items-center gap-1 shrink-0 cursor-pointer group">
            <div className="relative p-0.5 rounded-full border-2 border-dashed border-gray-300 dark:border-zinc-700 group-hover:border-blue-500 transition-colors">
              <img
                src={
                  profile?.avatar_url ||
                  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200'
                }
                alt="Your Story"
                className="w-11 h-11 rounded-full object-cover"
              />
              <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white rounded-full p-0.5 border-2 border-white dark:border-[#18191a]">
                <Plus className="w-3 h-3" />
              </div>
            </div>
            <span className="text-[11px] text-gray-600 dark:text-gray-400 font-medium truncate w-14 text-center">
              Your note
            </span>
          </div>

          {/* Active Contacts */}
          {activeContactsStories.map((contact) => (
            <div
              key={`story-${contact.id}`}
              onClick={() => handleSelectContact(contact)}
              className="flex flex-col items-center gap-1 shrink-0 cursor-pointer group"
            >
              <div className="relative p-0.5 rounded-full ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-offset-[#18191a] transition-all group-hover:scale-105">
                <img src={contact.avatar} alt={contact.name} className="w-11 h-11 rounded-full object-cover" />
                <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white dark:border-[#18191a]" />
              </div>
              <span className="text-[11px] text-gray-700 dark:text-gray-300 font-medium truncate w-14 text-center">
                {contact.name.split(' ')[0]}
              </span>
            </div>
          ))}
        </div>

        {/* Contacts List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {contactsList
            .filter(
              (c) =>
                c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (c.full_name && c.full_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (c.username && c.username.toLowerCase().includes(searchQuery.toLowerCase())) ||
                c.parish.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .map((contact, idx) => {
              const isActive = activeContact ? contact.id === activeContact.id : false;

              return (
                <button
                  key={`${contact.id}-${idx}`}
                  onClick={() => handleSelectContact(contact)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-2xl text-left transition-all cursor-pointer ${
                    isActive
                      ? 'bg-blue-50 dark:bg-zinc-800/80 font-semibold'
                      : 'hover:bg-gray-100 dark:hover:bg-zinc-800/50'
                  }`}
                >
                  <div className="relative shrink-0">
                    <img
                      src={contact.avatar}
                      alt={contact.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                    {contact.isOnline && (
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white dark:border-[#18191a]" />
                    )}
                  </div>

                  <div className="overflow-hidden min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p
                        className={`text-sm font-semibold truncate ${
                          isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'
                        }`}
                      >
                        {contact.name}
                      </p>
                      {contact.lastMessageTime && (
                        <TimeAgo
                          date={contact.lastMessageTime}
                          className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0 font-medium uppercase"
                        />
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-1 mt-0.5">
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {contact.lastMessage || contact.parish}
                      </p>
                      {contact.unreadCount ? (
                        <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
        </div>
      </div>

      {/* 2. MAIN CHAT AREA (VIEW B ON MOBILE) */}
      <div
        className={`flex-1 flex-col bg-white dark:bg-[#18191a] relative overflow-hidden h-full ${
          isMobileChatOpen ? 'flex' : 'hidden md:flex'
        }`}
      >
        {!activeContact ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-[#18191a]">
            <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 shadow-sm">
              <MessageCircle className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
              Select a conversation
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
              Choose a parishioner or priest from your contacts list on the left to start messaging.
            </p>
          </div>
        ) : (
          <>
            {/* Messenger Chat Header */}
            <div className="px-3 md:px-4 py-3 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between bg-white/90 dark:bg-[#18191a]/90 backdrop-blur-md z-10">
              <div className="flex items-center gap-2 md:gap-3 min-w-0">
                {/* Mobile Back Button */}
                <button
                  onClick={handleBackToList}
                  className="md:hidden p-2 -ml-1 rounded-full text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0 flex items-center justify-center"
                  title="Back to Conversations"
                  aria-label="Back to conversations"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>

                <div
                  className="flex items-center gap-2.5 cursor-pointer group min-w-0"
                  onClick={() =>
                    onSelectUser?.({
                      id: activeContact.id,
                      name: activeContact.name,
                      avatar: activeContact.avatar,
                      parish: activeContact.parish,
                    })
                  }
                >
            <div className="relative">
              <img
                src={activeContact.avatar}
                alt={activeContact.name}
                className="w-10 h-10 rounded-full object-cover group-hover:opacity-90 transition-opacity"
              />
              {activeContact.isOnline && (
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-[#18191a]" />
              )}
            </div>

            <div className="min-w-0">
              <h3 className="font-bold text-sm text-gray-900 dark:text-white truncate group-hover:underline">
                {activeContact.name}
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate flex items-center gap-1">
                {activeContact.isOnline ? (
                  <span className="text-emerald-500 font-medium">Active now</span>
                ) : (
                  <span>Offline</span>
                )}
                <span>•</span>
                <span>{activeContact.parish}</span>
              </p>
            </div>
          </div>
        </div>

          {/* WebRTC Audio & Video Calling Header Actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleStartCall('audio')}
              className="p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 text-blue-600 dark:text-blue-400 transition-colors cursor-pointer"
              title="Start Voice Call"
            >
              <Phone className="w-5 h-5" />
            </button>

            <button
              onClick={() => handleStartCall('video')}
              className="p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 text-blue-600 dark:text-blue-400 transition-colors cursor-pointer"
              title="Start Video Call"
            >
              <VideoIcon className="w-5 h-5" />
            </button>

            <button
              onClick={() => setShowRightSidebar((prev) => !prev)}
              className={`p-2.5 rounded-full transition-colors cursor-pointer ${
                showRightSidebar
                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                  : 'hover:bg-gray-100 dark:hover:bg-zinc-800 text-blue-600 dark:text-blue-400'
              }`}
              title="Conversation Information"
            >
              <Info className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Message Log Thread */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-white dark:bg-[#18191a]">
          {/* Header Contact Intro */}
          <div className="flex flex-col items-center justify-center my-6 text-center">
            <img
              src={activeContact.avatar}
              alt={activeContact.name}
              className="w-20 h-20 rounded-full object-cover shadow-md mb-2"
            />
            <h4 className="font-bold text-lg text-gray-900 dark:text-white">{activeContact.name}</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{activeContact.parish}</p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">
              You're connected on Messenger • OrthodoxConnect
            </p>
          </div>

          {messages.map((msg, index) => {
            const isMe = msg.sender_id === (profile?.id || 'me');
            const isHovered = hoveredMsgId === msg.id;

            return (
              <div
                key={msg.id}
                onMouseEnter={() => setHoveredMsgId(msg.id)}
                onMouseLeave={() => setHoveredMsgId(null)}
                className={`flex items-end gap-2 group ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                {/* Receiver Avatar on left */}
                {!isMe && (
                  <img
                    src={activeContact.avatar}
                    alt={activeContact.name}
                    className="w-7 h-7 rounded-full object-cover shrink-0 mb-1"
                  />
                )}

                {/* Reaction Quick Picker on Hover */}
                {isHovered && isMe && (
                  <div className="flex items-center gap-0.5 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 shadow-lg rounded-full px-2 py-0.5 animate-fadeIn">
                    {QUICK_EMOJIS.slice(0, 5).map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleToggleReaction(msg.id, emoji)}
                        className="hover:scale-125 transition-transform text-xs p-1 cursor-pointer"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}

                <div className={`relative max-w-xs sm:max-w-md flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  {/* Message Bubble */}
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-xs relative ${
                      isMe
                        ? `${activeTheme.bubbleBg} text-white rounded-br-xs`
                        : 'bg-[#e4e6eb] dark:bg-[#3a3b3c] text-gray-900 dark:text-gray-100 rounded-bl-xs'
                    }`}
                  >
                    {msg.content && <p className="whitespace-pre-wrap">{msg.content}</p>}

                    {/* Image Attachment */}
                    {msg.image_url && (
                      <img
                        src={msg.image_url}
                        alt="Attachment"
                        className="mt-2 rounded-xl max-h-60 object-cover border border-black/10"
                      />
                    )}

                    {/* Video Attachment */}
                    {msg.video_url && (
                      <video
                        src={msg.video_url}
                        controls
                        className="mt-2 rounded-xl max-h-60 w-full object-contain bg-black"
                      />
                    )}

                    {/* Audio Voice Note Player */}
                    {msg.audio_url && (
                      <div className="mt-2 p-2 rounded-xl bg-black/10 dark:bg-black/30 flex items-center gap-2">
                        <Volume2 className="w-4 h-4 shrink-0 text-current" />
                        <audio src={msg.audio_url} controls className="w-full h-8" />
                      </div>
                    )}

                    {/* Displayed Emoji Reaction Badge */}
                    {msg.reaction && (
                      <span className="absolute -bottom-2.5 right-1 bg-white dark:bg-zinc-800 text-xs px-1.5 py-0.5 rounded-full border border-gray-200 dark:border-zinc-700 shadow-sm">
                        {msg.reaction}
                      </span>
                    )}
                  </div>

                  {/* Timestamp & Seen Indicator */}
                  <div className="flex items-center gap-1 mt-1 px-1">
                    <TimeAgo date={msg.created_at} className="text-[10px] text-gray-400 dark:text-gray-500 font-medium" />
                    {isMe && index === messages.length - 1 && (
                      <span className="text-[10px] text-blue-500 font-medium">· Seen</span>
                    )}
                  </div>
                </div>

                {/* Reaction Quick Picker on Hover for Receiver */}
                {isHovered && !isMe && (
                  <div className="flex items-center gap-0.5 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 shadow-lg rounded-full px-2 py-0.5 animate-fadeIn">
                    {QUICK_EMOJIS.slice(0, 5).map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleToggleReaction(msg.id, emoji)}
                        className="hover:scale-125 transition-transform text-xs p-1 cursor-pointer"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Media Preview Box */}
        {(imageAttachment || videoAttachment) && (
          <div className="p-2 px-4 bg-gray-100 dark:bg-zinc-800 border-t border-gray-200 dark:border-zinc-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">Media attachment ready</span>
              {imageAttachment && <span className="text-[11px] text-gray-500">📷 Image</span>}
              {videoAttachment && <span className="text-[11px] text-gray-500">🎥 Video</span>}
            </div>
            <button
              onClick={() => {
                setImageAttachment('');
                setVideoAttachment('');
              }}
              className="p-1 text-gray-500 hover:text-red-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Messenger Input Toolbar */}
        <div className="p-3 border-t border-gray-200 dark:border-zinc-800 bg-white dark:bg-[#18191a]">
          {isRecording ? (
            /* Voice Note Recording Bar */
            <div className="flex items-center justify-between p-2.5 rounded-full bg-red-600 text-white animate-pulse">
              <div className="flex items-center gap-3 px-3">
                <Mic className="w-5 h-5" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Recording Voice Note ({recordingSeconds}s)
                </span>
              </div>
              <button
                type="button"
                onClick={stopRecording}
                className="px-4 py-1 bg-white text-red-600 hover:bg-gray-100 rounded-full text-xs font-bold uppercase tracking-wider shadow-md cursor-pointer"
              >
                Send
              </button>
            </div>
          ) : (
            <form onSubmit={(e) => handleSendMessage(undefined, e)} className="flex items-center gap-2">
              {/* Media Attach Buttons */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="p-2 rounded-full text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
                  title="Attach Photo"
                >
                  <ImageIcon className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  className="p-2 rounded-full text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
                  title="Attach Video"
                >
                  <Film className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={startRecording}
                  className="p-2 rounded-full text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
                  title="Record Voice Note"
                >
                  <Mic className="w-5 h-5" />
                </button>
              </div>

              {/* Message Pill Input */}
              <div className="flex-1 relative flex items-center">
                <input
                  type="text"
                  value={inputContent}
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder="Aa"
                  className="w-full pl-4 pr-10 py-2.5 text-sm rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />

                {/* Emoji Launcher Button */}
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker((prev) => !prev)}
                  className="absolute right-3 text-blue-600 dark:text-blue-400 hover:opacity-80 cursor-pointer"
                  title="Pick Emoji"
                >
                  <Smile className="w-5 h-5" />
                </button>

                {/* Floating Emoji Picker */}
                {showEmojiPicker && (
                  <div className="absolute bottom-12 right-0 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 shadow-2xl rounded-2xl p-3 grid grid-cols-4 gap-2 z-50 animate-fadeIn">
                    {QUICK_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          handleInputChange(inputContent + emoji);
                          setShowEmojiPicker(false);
                        }}
                        className="text-xl p-2 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-xl cursor-pointer"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Dynamic Action Button: Send or Messenger Thumbs Up 👍 */}
              {inputContent.trim() || imageAttachment || videoAttachment ? (
                <button
                  type="submit"
                  className="p-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white transition-all cursor-pointer shadow-md shrink-0"
                  title="Send Message"
                >
                  <Send className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSendMessage(activeEmoji)}
                  className="p-2 rounded-full text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
                  title="Send Quick Emoji"
                >
                  <span className="text-xl leading-none">{activeEmoji}</span>
                </button>
              )}
            </form>
          )}
        </div>
      </>
    )}
  </div>

  {/* 3. RIGHT SIDEBAR - MESSENGER CONVERSATION DETAILS & CUSTOMIZATION */}
  {showRightSidebar && activeContact && (
        <div className="w-72 lg:w-80 border-l border-gray-200 dark:border-zinc-800 bg-white dark:bg-[#18191a] p-4 flex flex-col overflow-y-auto hidden xl:flex shrink-0">
          <div className="flex flex-col items-center text-center pb-4 border-b border-gray-100 dark:border-zinc-800/80">
            <img
              src={activeContact.avatar}
              alt={activeContact.name}
              className="w-20 h-20 rounded-full object-cover shadow-sm mb-3"
            />
            <h4 className="font-bold text-base text-gray-900 dark:text-white">{activeContact.name}</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">{activeContact.parish}</p>

            {/* Quick Actions Row */}
            <div className="flex items-center justify-center gap-4 mt-4">
              <button
                onClick={() =>
                  onSelectUser?.({
                    id: activeContact.id,
                    name: activeContact.name,
                    avatar: activeContact.avatar,
                    parish: activeContact.parish,
                  })
                }
                className="flex flex-col items-center gap-1 group cursor-pointer"
              >
                <div className="p-2.5 rounded-full bg-gray-100 dark:bg-zinc-800 group-hover:bg-gray-200 dark:group-hover:bg-zinc-700 text-gray-800 dark:text-gray-200 transition-colors">
                  <User className="w-4 h-4" />
                </div>
                <span className="text-[11px] text-gray-600 dark:text-gray-400 font-medium">Profile</span>
              </button>

              <button className="flex flex-col items-center gap-1 group cursor-pointer">
                <div className="p-2.5 rounded-full bg-gray-100 dark:bg-zinc-800 group-hover:bg-gray-200 dark:group-hover:bg-zinc-700 text-gray-800 dark:text-gray-200 transition-colors">
                  <Bell className="w-4 h-4" />
                </div>
                <span className="text-[11px] text-gray-600 dark:text-gray-400 font-medium">Mute</span>
              </button>

              <button className="flex flex-col items-center gap-1 group cursor-pointer">
                <div className="p-2.5 rounded-full bg-gray-100 dark:bg-zinc-800 group-hover:bg-gray-200 dark:group-hover:bg-zinc-700 text-gray-800 dark:text-gray-200 transition-colors">
                  <Search className="w-4 h-4" />
                </div>
                <span className="text-[11px] text-gray-600 dark:text-gray-400 font-medium">Search</span>
              </button>
            </div>
          </div>

          {/* Messenger Settings Accordion */}
          <div className="mt-4 space-y-4">
            {/* Theme Customizer */}
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-blue-500" />
                  <span>Customize Chat</span>
                </span>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-gray-600 dark:text-gray-300 font-medium">Theme Color</p>
                <div className="flex items-center gap-2">
                  {MESSENGER_THEMES.map((theme) => (
                    <button
                      key={theme.id}
                      onClick={() => setActiveTheme(theme)}
                      className={`w-6 h-6 rounded-full ${theme.gradient} transition-transform ${
                        activeTheme.id === theme.id ? 'ring-2 ring-blue-500 ring-offset-2 scale-110' : ''
                      }`}
                      title={theme.name}
                    />
                  ))}
                </div>
              </div>

              {/* Change Quick Emoji */}
              <div className="mt-3">
                <p className="text-xs text-gray-600 dark:text-gray-300 font-medium mb-1">Quick Reaction Emoji</p>
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                  {QUICK_EMOJIS.map((emoji) => (
                    <button
                      key={`quick-${emoji}`}
                      onClick={() => setActiveEmoji(emoji)}
                      className={`text-base p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors ${
                        activeEmoji === emoji ? 'bg-blue-100 dark:bg-blue-900/40 ring-1 ring-blue-500' : ''
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Shared Media */}
            <div className="pt-2 border-t border-gray-100 dark:border-zinc-800">
              <div className="flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-blue-500" />
                  <span>Shared Media</span>
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <img
                  src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200"
                  alt="Shared"
                  className="w-full h-16 object-cover rounded-lg"
                />
                <img
                  src="https://images.unsplash.com/photo-1519817650390-64a93db51149?auto=format&fit=crop&q=80&w=200"
                  alt="Shared"
                  className="w-full h-16 object-cover rounded-lg"
                />
                <img
                  src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200"
                  alt="Shared"
                  className="w-full h-16 object-cover rounded-lg"
                />
              </div>
            </div>

            {/* Privacy & Safety */}
            <div className="pt-2 border-t border-gray-100 dark:border-zinc-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-blue-500" />
                  <span>Privacy & Support</span>
                </span>
              </div>

              <button className="w-full text-left text-xs text-gray-700 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 py-1 transition-colors">
                Block {activeContact.name.split(' ')[0]}
              </button>
              <button className="w-full text-left text-xs text-gray-700 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 py-1 transition-colors">
                Report Conversation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WebRTC Call Modal */}
      <WebRTCCallModal callState={activeCall} onEndCall={() => setActiveCall(null)} />
    </div>
  );
};
